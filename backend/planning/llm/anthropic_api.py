"""Production backend: the Claude API through the official SDK.

Facts from the claude-api skill (checked 2026-11-12): default model `claude-opus-5-5`;
JSON is forced with `output_config.format` (`json_schema`); thinking is always on for
this model and counts toward `max_tokens`. A server-side fallback model answers if the
main model declines (`fallbacks: "default"`), so a refusal does not end the request.
"""

import json

import anthropic

from planning.llm.base import LLMError

DEFAULT_MODEL = "claude-opus-5-5"
# A hard cap on the answer length (thinking included). The plan JSON is small.
MAX_OUTPUT_TOKENS = 4000
TIMEOUT_S = 30
FALLBACK_BETA = "server-side-fallback-2026-07-01"


class AnthropicClient:
    name = "anthropic"

    def __init__(self, api_key, model=""):
        if not api_key:
            raise LLMError("ANTHROPIC_API_KEY is not set")
        self.model = model or DEFAULT_MODEL
        # One retry at most: the user is waiting, and the rules engine is the fallback.
        self.client = anthropic.Anthropic(api_key=api_key, timeout=TIMEOUT_S, max_retries=1)

    def complete_json(self, system, user, schema):
        try:
            response = self.client.beta.messages.create(
                model=self.model,
                max_tokens=MAX_OUTPUT_TOKENS,
                betas=[FALLBACK_BETA],
                fallbacks="default",
                system=system,
                messages=[{"role": "user", "content": user}],
                output_config={"format": {"type": "json_schema", "schema": schema}},
            )
        except anthropic.APIError as exc:
            raise LLMError(f"Anthropic API error: {type(exc).__name__}") from exc
        if response.stop_reason != "end_turn":
            raise LLMError(f"Anthropic answer stopped: {response.stop_reason}")
        text = next((b.text for b in response.content if b.type == "text"), "")
        try:
            answer = json.loads(text)
        except ValueError as exc:
            raise LLMError("Anthropic answer is not JSON") from exc
        if not isinstance(answer, dict):
            raise LLMError("Anthropic answer is not a JSON object")
        return answer
