"""Spare backend: NVIDIA NIM, an OpenAI-compatible chat completions endpoint (plain httpx).

Checked by hand on 2026-11-12 (docs/DECISIONS.md): `response_format: json_object` works,
`nvext.guided_json` gives 400, so the schema is only in the prompt and our validation
checks the shape. The default model reasons first (in a separate field) and needs a
large token budget; only `content` is read.
"""

import json
import re

import httpx

from planning.llm.base import LLMError

URL = "https://integrate.api.nvidia.com/v1/chat/completions"
TIMEOUT_S = 60
MAX_OUTPUT_TOKENS = 2000
THINK_BLOCK = re.compile(r"<think>.*?</think>", re.DOTALL)
CODE_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$")


def make_client(timeout=TIMEOUT_S):
    """The HTTP client. Tests replace this function with one that uses a MockTransport."""
    return httpx.Client(timeout=timeout)


class NvidiaClient:
    name = "nvidia"

    def __init__(self, api_key, model):
        if not api_key:
            raise LLMError("NVIDIA_API_KEY is not set")
        self.api_key = api_key
        self.model = model

    def complete_json(self, system, user, schema, timeout_s=None):
        timeout = min(TIMEOUT_S, timeout_s or TIMEOUT_S)
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": f"{system}\nJSON schema:\n{json.dumps(schema)}"},
                {"role": "user", "content": user},
            ],
            "max_tokens": MAX_OUTPUT_TOKENS,
            "temperature": 0,
            "response_format": {"type": "json_object"},
        }
        headers = {"Authorization": f"Bearer {self.api_key}", "Accept": "application/json"}
        try:
            with make_client(timeout=timeout) as client:
                response = client.post(URL, json=body, headers=headers)
            response.raise_for_status()
            choice = response.json()["choices"][0]
        except httpx.HTTPStatusError as exc:
            raise LLMError(f"NVIDIA answered {exc.response.status_code}") from exc
        except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError) as exc:
            raise LLMError(f"NVIDIA request failed: {type(exc).__name__}") from exc
        if choice.get("finish_reason") == "length":
            raise LLMError("NVIDIA answer was cut off (token limit)")
        return parse_content((choice.get("message") or {}).get("content"))


def parse_content(content):
    text = THINK_BLOCK.sub("", content or "").strip()
    text = CODE_FENCE.sub("", text).strip()
    if not text:
        raise LLMError("NVIDIA answer is empty")
    try:
        answer = json.loads(text)
    except ValueError as exc:
        raise LLMError("NVIDIA answer is not JSON") from exc
    if not isinstance(answer, dict):
        raise LLMError("NVIDIA answer is not a JSON object")
    return answer
