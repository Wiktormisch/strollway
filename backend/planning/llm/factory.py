"""The only place that reads LLM_BACKEND, LLM_FALLBACKS and the backend keys.

LLM_BACKEND=mock (the default) means no LLM: the rule-based planner builds every trip.
Otherwise the chain is LLM_BACKEND followed by LLM_FALLBACKS, in order, without repeats.
A backend that cannot be built (unknown name, missing key) is skipped with a warning.
"""

import logging

from django.conf import settings

from planning.llm.anthropic_api import AnthropicClient
from planning.llm.base import LLMError
from planning.llm.claude_cli import ClaudeCliClient
from planning.llm.nvidia import NvidiaClient

logger = logging.getLogger(__name__)

MOCK = "mock"


def _build(name):
    if name == "claude_cli":
        return ClaudeCliClient(settings.CLAUDE_CLI_MODEL)
    if name == "anthropic":
        return AnthropicClient(settings.ANTHROPIC_API_KEY, settings.ANTHROPIC_MODEL)
    if name == "nvidia":
        return NvidiaClient(settings.NVIDIA_API_KEY, settings.NVIDIA_MODEL)
    raise LLMError(f"unknown LLM backend {name!r}")


def backend_names():
    """Configured names in order: LLM_BACKEND, then LLM_FALLBACKS. Empty for mock."""
    first = (settings.LLM_BACKEND or MOCK).strip().lower()
    if first == MOCK:
        return []
    names = []
    for name in [first, *(n.strip().lower() for n in settings.LLM_FALLBACKS)]:
        if name and name != MOCK and name not in names:
            names.append(name)
    return names


def build_chain():
    """The ordered list of usable LLM clients."""
    chain = []
    for name in backend_names():
        try:
            chain.append(_build(name))
        except LLMError as exc:
            logger.warning("LLM backend %s skipped: %s", name, exc)
    return chain
