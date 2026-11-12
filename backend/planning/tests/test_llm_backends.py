"""LLM backends with no real LLM, CLI or network: subprocess, httpx and the SDK are faked."""

import json
import subprocess
from pathlib import Path
from types import SimpleNamespace

import anthropic
import pytest

from planning.llm import anthropic_api, claude_cli, factory, nvidia
from planning.llm.base import LLMError
from planning.tests.conftest import FakeHttp

ANSWER = {"summary": "Ok.", "stops": [], "unmet_wishes": [], "tips": []}
SCHEMA = {"type": "object"}
REPO_ROOT = Path(__file__).resolve().parents[3]


# --- factory ---------------------------------------------------------------------------


@pytest.fixture
def keys(settings):
    settings.ANTHROPIC_API_KEY = "test-anthropic"
    settings.NVIDIA_API_KEY = "test-nvidia"


def test_mock_means_no_llm(settings, keys):
    settings.LLM_BACKEND = "mock"
    settings.LLM_FALLBACKS = ["nvidia"]

    assert factory.backend_names() == []
    assert factory.build_chain() == []


def test_chain_keeps_the_order_and_drops_repeats(settings, keys):
    settings.LLM_BACKEND = "claude_cli"
    settings.LLM_FALLBACKS = ["anthropic", "claude_cli", "mock", "nvidia"]

    chain = factory.build_chain()

    assert [c.name for c in chain] == ["claude_cli", "anthropic", "nvidia"]


def test_backends_without_a_key_or_unknown_are_skipped(settings, caplog):
    settings.LLM_BACKEND = "anthropic"
    settings.LLM_FALLBACKS = ["gpt", "nvidia"]

    assert factory.build_chain() == []
    assert "ANTHROPIC_API_KEY is not set" in caplog.text
    assert "unknown LLM backend 'gpt'" in caplog.text


# --- claude_cli ------------------------------------------------------------------------


@pytest.fixture
def cli(monkeypatch):
    """Fake `claude` executable and subprocess.run; records the call."""
    calls = []
    result = {"value": None}

    def run(args, **kwargs):
        calls.append({"args": args, **kwargs})
        assert Path(kwargs["cwd"]).is_dir()
        if isinstance(result["value"], Exception):
            raise result["value"]
        return result["value"]

    monkeypatch.setattr(claude_cli.shutil, "which", lambda name: r"C:\bin\claude.EXE")
    monkeypatch.setattr(claude_cli.subprocess, "run", run)
    return SimpleNamespace(calls=calls, result=result)


def done(stdout, code=0):
    return subprocess.CompletedProcess(args=[], returncode=code, stdout=stdout, stderr="")


def test_cli_runs_without_shell_in_an_empty_temp_dir(cli):
    cli.result["value"] = done(json.dumps({"is_error": False, "structured_output": ANSWER}))

    answer = claude_cli.ClaudeCliClient().complete_json("SYSTEM", "USER", SCHEMA)

    call = cli.calls[0]
    assert answer == ANSWER
    assert isinstance(call["args"], list)
    assert "shell" not in call or call["shell"] is False
    assert call["input"] == "USER"  # the prompt goes through stdin
    assert "USER" not in call["args"]
    assert call["timeout"] == 60
    workdir = Path(call["cwd"]).resolve()
    assert REPO_ROOT not in workdir.parents and workdir != REPO_ROOT
    for flag in ("-p", "--safe-mode", "--no-session-persistence", "--json-schema"):
        assert flag in call["args"]
    assert call["args"][call["args"].index("--tools") + 1] == ""
    assert call["args"][call["args"].index("--system-prompt") + 1] == "SYSTEM"


def test_cli_temp_dir_is_removed_afterwards(cli):
    cli.result["value"] = done(json.dumps({"structured_output": ANSWER}))
    claude_cli.ClaudeCliClient().complete_json("S", "U", SCHEMA)
    assert not Path(cli.calls[0]["cwd"]).exists()


def test_cli_falls_back_to_the_result_text(cli):
    cli.result["value"] = done(json.dumps({"result": json.dumps(ANSWER)}))
    assert claude_cli.ClaudeCliClient().complete_json("S", "U", SCHEMA) == ANSWER


def test_cli_passes_the_model_when_set(cli):
    cli.result["value"] = done(json.dumps({"structured_output": ANSWER}))
    claude_cli.ClaudeCliClient(model="opus").complete_json("S", "U", SCHEMA)
    assert cli.calls[0]["args"][-2:] == ["--model", "opus"]


@pytest.mark.parametrize(
    "outcome",
    [
        subprocess.TimeoutExpired(cmd="claude", timeout=60),
        FileNotFoundError(),
        done("", code=1),
        done("not json"),
        done(json.dumps({"is_error": True, "subtype": "error_max_turns"})),
        done(json.dumps({"result": "Sure! Here is the plan."})),
        done(json.dumps({"structured_output": ["a list"]})),
    ],
)
def test_cli_failures_raise_llm_error(cli, outcome):
    cli.result["value"] = outcome
    with pytest.raises(LLMError):
        claude_cli.ClaudeCliClient().complete_json("S", "U", SCHEMA)


def test_cli_missing_or_batch_file_is_an_error(monkeypatch):
    monkeypatch.setattr(claude_cli.shutil, "which", lambda name: None)
    with pytest.raises(LLMError, match="not found"):
        claude_cli.ClaudeCliClient().complete_json("S", "U", SCHEMA)

    monkeypatch.setattr(claude_cli.shutil, "which", lambda name: r"C:\bin\claude.cmd")
    with pytest.raises(LLMError, match="batch file"):
        claude_cli.ClaudeCliClient().complete_json("S", "U", SCHEMA)


# --- nvidia ----------------------------------------------------------------------------


@pytest.fixture
def nim(monkeypatch):
    fake = FakeHttp()
    monkeypatch.setattr(nvidia, "make_client", fake.client)
    return fake


def completion(content, finish="stop"):
    return {"choices": [{"finish_reason": finish, "message": {"content": content}}]}


def test_nvidia_request_and_answer(nim):
    nim.add(body=completion(json.dumps(ANSWER)))

    answer = nvidia.NvidiaClient("key", "nvidia/model").complete_json("S", "U", SCHEMA)

    sent = nim.json_bodies()[0]
    assert answer == ANSWER
    assert sent["model"] == "nvidia/model"
    assert sent["response_format"] == {"type": "json_object"}
    assert "nvext" not in sent
    assert nim.requests[0].headers["Authorization"] == "Bearer key"


def test_nvidia_strips_think_blocks_and_fences(nim):
    nim.add(body=completion("<think>hmm</think>\n```json\n" + json.dumps(ANSWER) + "\n```"))
    assert nvidia.NvidiaClient("key", "m").complete_json("S", "U", SCHEMA) == ANSWER


@pytest.mark.parametrize(
    "response",
    [
        {"status": 429, "body": {}},
        {"status": 200, "body": completion("", finish="length")},
        {"status": 200, "body": completion(None)},
        {"status": 200, "body": completion("not json")},
        {"status": 200, "body": {"choices": []}},
    ],
)
def test_nvidia_failures_raise_llm_error(nim, response):
    nim.add(**response)
    with pytest.raises(LLMError):
        nvidia.NvidiaClient("key", "m").complete_json("S", "U", SCHEMA)


def test_nvidia_needs_a_key():
    with pytest.raises(LLMError):
        nvidia.NvidiaClient("", "m")


# --- anthropic -------------------------------------------------------------------------


def fake_message(text, stop_reason="end_turn"):
    return SimpleNamespace(
        stop_reason=stop_reason, content=[SimpleNamespace(type="text", text=text)]
    )


@pytest.fixture
def sdk(monkeypatch):
    calls = []
    result = {"value": fake_message(json.dumps(ANSWER))}

    def create(**kwargs):
        calls.append(kwargs)
        if isinstance(result["value"], Exception):
            raise result["value"]
        return result["value"]

    client = anthropic_api.AnthropicClient("test-key", "")
    monkeypatch.setattr(client.client.beta.messages, "create", create)
    return SimpleNamespace(client=client, calls=calls, result=result)


def test_anthropic_forces_json_and_caps_tokens(sdk):
    answer = sdk.client.complete_json("SYSTEM", "USER", SCHEMA)

    sent = sdk.calls[0]
    assert answer == ANSWER
    assert sent["model"] == "claude-opus-5-5"
    assert sent["max_tokens"] == anthropic_api.MAX_OUTPUT_TOKENS
    assert sent["output_config"] == {"format": {"type": "json_schema", "schema": SCHEMA}}
    assert sent["system"] == "SYSTEM"
    assert sent["messages"] == [{"role": "user", "content": "USER"}]


@pytest.mark.parametrize(
    "value",
    [
        fake_message("{}", stop_reason="refusal"),
        fake_message("{", stop_reason="max_tokens"),
        fake_message("not json"),
        anthropic.APIConnectionError(request=None),
    ],
)
def test_anthropic_failures_raise_llm_error(sdk, value):
    sdk.result["value"] = value
    with pytest.raises(LLMError):
        sdk.client.complete_json("S", "U", SCHEMA)


def test_anthropic_needs_a_key():
    with pytest.raises(LLMError):
        anthropic_api.AnthropicClient("", "")


def test_cli_output_is_decoded_safely(cli):
    cli.result["value"] = done(json.dumps({"structured_output": ANSWER}))
    claude_cli.ClaudeCliClient().complete_json("S", "U", SCHEMA)
    assert cli.calls[0]["encoding"] == "utf-8"
    assert cli.calls[0]["errors"] == "replace"
