"""Local development backend: the Claude Code CLI (`claude -p`), using the developer's login.

Checked by hand on 2026-11-12 (docs/DECISIONS.md):
- `--safe-mode` stops the CLI from loading the user's global CLAUDE.md, skills and hooks;
  an empty temporary working directory keeps this repo's CLAUDE.md out as well.
- With `--json-schema` the answer object is in the `structured_output` field.
Safety: an argument list, never shell=True; the prompt goes through stdin.
"""

import json
import shutil
import subprocess
import tempfile

from planning.llm.base import LLMError

TIMEOUT_S = 60


class ClaudeCliClient:
    name = "claude_cli"

    def __init__(self, model=""):
        self.model = model

    def complete_json(self, system, user, schema, timeout_s=None):
        timeout = min(TIMEOUT_S, timeout_s or TIMEOUT_S)
        executable = shutil.which("claude")
        if executable is None:
            raise LLMError("claude CLI not found on PATH")
        if executable.lower().endswith((".cmd", ".bat")):
            # Batch files run through cmd.exe, which re-parses the arguments.
            raise LLMError("claude CLI is a batch file; only a real executable is allowed")
        args = self.command(executable, system, schema)
        with tempfile.TemporaryDirectory(prefix="strollway-llm-") as workdir:
            try:
                done = subprocess.run(  # noqa: S603 - fixed argument list, no shell
                    args,
                    input=user,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",  # a stray non-UTF-8 byte must not crash the request
                    timeout=timeout,
                    cwd=workdir,
                    check=False,
                )
            except subprocess.TimeoutExpired as exc:
                raise LLMError(f"claude CLI timed out after {timeout:.0f} s") from exc
            except OSError as exc:
                raise LLMError(f"claude CLI could not start: {type(exc).__name__}") from exc
        if done.returncode != 0:
            raise LLMError(f"claude CLI exited with code {done.returncode}")
        return parse_output(done.stdout)

    def command(self, executable, system, schema):
        args = [
            executable,
            "-p",
            "--output-format",
            "json",
            "--tools",
            "",
            "--no-session-persistence",
            "--safe-mode",
            "--system-prompt",
            system,
            "--json-schema",
            json.dumps(schema),
        ]
        if self.model:
            args += ["--model", self.model]
        return args


def parse_output(stdout):
    """The answer object from the CLI's JSON result."""
    try:
        result = json.loads(stdout)
    except ValueError as exc:
        raise LLMError("claude CLI output is not JSON") from exc
    if not isinstance(result, dict) or result.get("is_error"):
        raise LLMError(f"claude CLI reported an error ({result.get('subtype', 'unknown')})")
    answer = result.get("structured_output")
    if answer is None:
        try:
            answer = json.loads(result.get("result") or "")
        except ValueError as exc:
            raise LLMError("claude CLI result is not JSON") from exc
    if not isinstance(answer, dict):
        raise LLMError("claude CLI answer is not a JSON object")
    return answer
