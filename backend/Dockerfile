# StrollWay backend: Django on gunicorn. Built by docker-compose.yml in the repo root.
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    VAR_DIR=/app/var

WORKDIR /app

# Dependencies first, so code changes do not reinstall them.
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Run as a normal user, not root. /app/var is the mounted volume for SQLite and the cache.
RUN useradd --create-home --uid 1000 app \
    && mkdir -p /app/var /app/staticfiles \
    && chown -R app:app /app/var /app/staticfiles
USER app

EXPOSE 8000
ENTRYPOINT ["sh", "/app/entrypoint.sh"]
