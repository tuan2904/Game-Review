#!/bin/sh
set -e

echo "Waiting for database..."
python - <<'PY'
import os, time
import psycopg

for attempt in range(30):
    try:
        with psycopg.connect(
            dbname=os.environ.get("DB_NAME", "gamereview"),
            user=os.environ.get("DB_USER", "tuanhd"),
            password=os.environ.get("DB_PASSWORD", ""),
            host=os.environ.get("DB_HOST", "db"),
            port=int(os.environ.get("DB_PORT", "5432")),
        ) as conn:
            conn.execute("SELECT 1")
        print("Database is ready.")
        break
    except Exception as e:
        print(f"DB not ready ({attempt + 1}/30): {e}")
        time.sleep(2)
else:
    raise SystemExit("Database did not become ready in time.")
PY

echo "Running migrations..."
python manage.py migrate --noinput

echo "Checking seed data..."
python - <<'PY'
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from pathlib import Path

import psycopg
from apps.games.models import Game

if Game.objects.exists():
    print("DB already has games, skipping seed.")
else:
    seed = Path("/app/seed_data.sql")
    if not seed.exists():
        print("No seed file found, skipping.")
    else:
        with psycopg.connect(
            dbname=os.environ.get("DB_NAME", "gamereview"),
            user=os.environ.get("DB_USER", "tuanhd"),
            password=os.environ.get("DB_PASSWORD", ""),
            host=os.environ.get("DB_HOST", "db"),
            port=int(os.environ.get("DB_PORT", "5432")),
        ) as conn:
            conn.execute(seed.read_text())
        print("Seeded sample data.")
PY

exec "$@"
