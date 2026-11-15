"""Production settings: load config.settings in a fresh process with DEBUG=0.

A subprocess is used because settings are read once at import time; changing os.environ
inside the test process would not reload them.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent

PROD_ENV = {
    "DEBUG": "0",
    "SECRET_KEY": "test-only-" + "x" * 60,
    "ALLOWED_HOSTS": "strollway.example.dev",
    "CSRF_TRUSTED_ORIGINS": "https://strollway.example.dev",
    "DRF_NUM_PROXIES": "1",
}

PRINT_SETTINGS = """
import json, django
from django.conf import settings
django.setup()
print(json.dumps({
    "debug": settings.DEBUG,
    "proxy_header": list(settings.SECURE_PROXY_SSL_HEADER),
    "session_secure": settings.SESSION_COOKIE_SECURE,
    "csrf_secure": settings.CSRF_COOKIE_SECURE,
    "hsts": settings.SECURE_HSTS_SECONDS,
    "csrf_origins": settings.CSRF_TRUSTED_ORIGINS,
    "num_proxies": settings.REST_FRAMEWORK["NUM_PROXIES"],
    "db": str(settings.DATABASES["default"]["NAME"]),
    "cache": str(settings.CACHES["default"]["LOCATION"]),
    "middleware": settings.MIDDLEWARE,
}))
"""


def run_python(args, tmp_path, extra_env=None):
    env = {**os.environ, **PROD_ENV, "VAR_DIR": str(tmp_path), **(extra_env or {})}
    env["DJANGO_SETTINGS_MODULE"] = "config.settings"
    return subprocess.run(
        [sys.executable, *args], cwd=BACKEND_DIR, env=env, capture_output=True, text=True
    )


def test_production_settings_are_secure(tmp_path):
    result = run_python(["-c", PRINT_SETTINGS], tmp_path)
    assert result.returncode == 0, result.stderr
    values = json.loads(result.stdout)

    assert values["debug"] is False
    assert values["proxy_header"] == ["HTTP_X_FORWARDED_PROTO", "https"]
    assert values["session_secure"] is True
    assert values["csrf_secure"] is True
    assert values["hsts"] > 0
    assert values["csrf_origins"] == ["https://strollway.example.dev"]
    assert values["num_proxies"] == 1
    assert "whitenoise.middleware.WhiteNoiseMiddleware" in values["middleware"]


def test_writable_files_live_in_var_dir(tmp_path):
    result = run_python(["-c", PRINT_SETTINGS], tmp_path)
    values = json.loads(result.stdout)

    assert Path(values["db"]) == tmp_path / "db.sqlite3"
    assert Path(values["cache"]) == tmp_path / ".cache"


def test_check_deploy_has_no_warnings(tmp_path):
    result = run_python(["manage.py", "check", "--deploy", "--fail-level", "WARNING"], tmp_path)

    assert result.returncode == 0, result.stdout + result.stderr


def test_missing_secret_key_fails_in_production(tmp_path):
    result = run_python(["-c", PRINT_SETTINGS], tmp_path, {"SECRET_KEY": ""})

    assert result.returncode != 0
    assert "SECRET_KEY must be set" in result.stderr
