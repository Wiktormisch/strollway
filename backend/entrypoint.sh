#!/bin/sh
# Start script for the "web" container. Every step is safe to run on each start.
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput
# Replaces the Place table from the committed export (one transaction).
python manage.py import_places data/places_tricity.json.gz
python manage.py seed_demo

exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers "${GUNICORN_WORKERS:-2}" \
    --timeout 120 \
    --access-logfile -
