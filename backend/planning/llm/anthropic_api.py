"""Production backend: the Claude API through the official SDK.

Facts from the claude-api skill (checked 2026-11-12): default model `claude-opus-5-5`;
JSON is forced with `output_config.format` (`json_schema`); thinking is always on for
this model and counts toward `max_tokens`. A server-side fallback model answers if the
main model declines (`fallbacks: "default"`), so a refusal does not end the request.
The effort is set explicitly (`output_config.effort`), as the skill advises for this model:
`medium` (measured, docs/DECISIONS.md): `low` was faster but gave an invalid answer.
"""

import json
import logging

import anthropic

from planning.llm.base import LLMError

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "claude-opus-5-5"
# A cap on the answer length. Thinking counts toward it, so it is not set too low:
# a cut answer is paid for and then thrown away.
MAX_OUTPUT_TOKENS = 8000
EFFORT = "medium"
TIMEOUT_S = 30
FALLBACK_BETA = "server-side-fallback-2026-07-01"


class AnthropicClient:
    name = "anthropic"

    def __init__(self, api_key, model=""):
        if not api_key:
            raise LLMError("ANTHROPIC_API_KEY is not set")
        self.model = model or DEFAULT_MODEL
        # No retries: a retry could double the wait past the request deadline.
        # The next backend in the chain, or the rules engine, is the fallback.
        self.client = anthropic.Anthropic(api_key=api_key, timeout=TIMEOUT_S, max_retries=0)

    def complete_json(self, system, user, schema, timeout_s=None):
        timeout = min(TIMEOUT_S, timeout_s or TIMEOUT_S)
        try:
            response = self.client.beta.messages.create(
                model=self.model,
                max_tokens=MAX_OUTPUT_TOKENS,
                betas=[FALLBACK_BETA],
                fallbacks="default",
                system=system,
                messages=[{"role": "user", "content": user}],
                output_config={
                    "effort": EFFORT,
                    "format": {"type": "json_schema", "schema": schema},
                },
                timeout=timeout,
            )
        except anthropic.APIError as exc:
            raise LLMError(f"Anthropic API error: {type(exc).__name__}") from exc
        usage = getattr(response, "usage", None)
        logger.info(
            "Anthropic answer: stop=%s output_tokens=%s",
            response.stop_reason,
            getattr(usage, "output_tokens", None),
        )
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
