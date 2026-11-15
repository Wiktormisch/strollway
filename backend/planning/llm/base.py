"""The one small interface every LLM backend implements (docs/PLAN.md D.6)."""

from typing import Protocol


class LLMError(Exception):
    """Any failure of a backend: no key, timeout, HTTP error, refusal, bad JSON.

    The message is ours and short. It never contains the prompt, the wishes text or
    the model answer, because it is logged.
    """


class LLMClient(Protocol):
    name: str

    def complete_json(
        self, system: str, user: str, schema: dict, timeout_s: float | None = None
    ) -> dict:
        """Return the parsed JSON object, or raise LLMError.

        `timeout_s` is the time left in the request. The backend never waits longer than
        this or its own timeout, whichever is shorter (retries included).
        """
        ...
