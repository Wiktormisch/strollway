"""Django settings for StrollWay.

Values that change between machines come from environment variables,
loaded from backend/.env (see .env.example).
"""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")


def env_list(name: str, default: str = "") -> list[str]:
    """Read a comma-separated variable as a list without empty items."""
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


DEBUG = os.getenv("DEBUG", "0") == "1"
SECRET_KEY = os.getenv("SECRET_KEY", "")
if not SECRET_KEY:
    if not DEBUG:
        raise RuntimeError("SECRET_KEY must be set when DEBUG is off.")
    SECRET_KEY = "dev-only-insecure-key"

ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "drf_spectacular",
    "walks",
    "planning",
]

MIDDLEWARE = [
    # CorsMiddleware must be as high as possible, before CommonMiddleware.
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Europe/Warsaw"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# CORS: only the origins listed in .env. Never allow all origins.
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:5173")
CORS_ALLOW_HEADERS = ["accept", "content-type", "x-client-id"]

# Defaults of the per-IP limits; .env can change them (tests check these, not .env).
ROUTE_PLANS_DEFAULT_RATE = "60/hour"
TRIP_IDEAS_DEFAULT_RATE = "20/hour"
WRITES_DEFAULT_RATE = "120/hour"

# How many walks one client can keep. `or` also covers an empty value in .env.
MAX_WALKS_PER_CLIENT_DEFAULT = 200
MAX_WALKS_PER_CLIENT = int(os.getenv("MAX_WALKS_PER_CLIENT") or MAX_WALKS_PER_CLIENT_DEFAULT)

REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    # No login in this app; clients are told apart by the X-Client-Id header.
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "UNAUTHENTICATED_USER": None,
    # Per-IP limits: the endpoints that call shared external APIs, and all writes to the
    # walks API (walks, stops, profiles, demo data).
    "DEFAULT_THROTTLE_RATES": {
        "route_plans": os.getenv("ROUTE_PLANS_RATE", ROUTE_PLANS_DEFAULT_RATE),
        "trip_ideas": os.getenv("TRIP_IDEAS_RATE", TRIP_IDEAS_DEFAULT_RATE),
        "writes": os.getenv("WRITES_RATE", WRITES_DEFAULT_RATE),
    },
    # How many reverse proxies stand in front of Django. 0 = trust only the TCP address,
    # so a client cannot pick its own "IP" with an X-Forwarded-For header and skip the
    # limits. Behind one proxy (e.g. nginx or a PaaS router), set DRF_NUM_PROXIES=1.
    "NUM_PROXIES": int(os.getenv("DRF_NUM_PROXIES", "0")),
}

# File cache for external API results (ORS and Overpass), 24 h. Survives restarts.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.filebased.FileBasedCache",
        "LOCATION": BASE_DIR / ".cache",
        "TIMEOUT": 24 * 60 * 60,
    }
}

# External services. See docs/DECISIONS.md for verified facts.
ROUTING_PROVIDER = os.getenv("ROUTING_PROVIDER", "auto")  # auto | ors | mock
ORS_BASE_URL = os.getenv("ORS_BASE_URL", "https://api.heigit.org/openrouteservice").rstrip("/")
ORS_API_KEY = os.getenv("ORS_API_KEY", "")
# db = our Place table (run `import_places` first); overpass = live; "auto" = overpass.
POI_PROVIDER = os.getenv("POI_PROVIDER", "db")  # db | overpass | mock
OVERPASS_URL = os.getenv("OVERPASS_URL", "https://overpass-api.de/api/interpreter")

WEATHER_PROVIDER = os.getenv("WEATHER_PROVIDER", "auto")  # auto | mock
WEATHER_URL = os.getenv("WEATHER_URL", "https://api.open-meteo.com/v1/forecast")

# Trip ideas (docs/PLAN.md D.6). Only planning/llm/factory.py reads the LLM_* settings.
LLM_BACKEND = os.getenv("LLM_BACKEND", "mock")  # mock | claude_cli | anthropic | nvidia
LLM_FALLBACKS = env_list("LLM_FALLBACKS", "")
LLM_DAILY_LIMIT = int(os.getenv("LLM_DAILY_LIMIT", "300"))
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "")
CLAUDE_CLI_MODEL = os.getenv("CLAUDE_CLI_MODEL", "")  # empty = the CLI default
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
NVIDIA_MODEL = os.getenv("NVIDIA_MODEL", "nvidia/nemotron-3.5-lightning-30b-a3b")

SPECTACULAR_SETTINGS = {
    "TITLE": "StrollWay API",
    "DESCRIPTION": "Stair-free walks for families with a stroller.",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    # Separate request and response components, so generated frontend types do not
    # require read-only fields (id, created_at) in POST and PATCH bodies.
    "COMPONENT_SPLIT_REQUEST": True,
    # Two different "source" choice sets (Stop.source and route-plans source) need own names.
    "ENUM_NAME_OVERRIDES": {
        "RoutePlanSourceEnum": ["ors", "fixture", "mock"],
        "StopSourceEnum": "walks.models.Stop.Source",
    },
}
