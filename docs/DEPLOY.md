# Deploy

StrollWay runs on a small VPS as its own Docker Compose stack at
`https://strollway.wiktormischker.dev`. It does not touch other stacks on the server.

```
Internet -> Cloudflare (TLS) -> tunnel -> cloudflared -> nginx:80 -+-> /        built frontend
                                                                   +-> /api/    web:8000 (gunicorn)
                                                                   +-> /static/ web:8000 (WhiteNoise)
```

| Service       | Image / build             | What it does                                                                    |
| ------------- | ------------------------- | ------------------------------------------------------------------------------- |
| `web`         | `backend/Dockerfile`      | Django on gunicorn. On start: migrate, collectstatic, import places, seed demo. |
| `nginx`       | `deploy/nginx/Dockerfile` | Builds the frontend, serves it, proxies `/api/` and `/static/`.                 |
| `cloudflared` | `cloudflare/cloudflared`  | Cloudflare tunnel. Only with the `tunnel` profile.                              |

Files on the server, next to `docker-compose.yml`:

- `.env`: secrets, written by hand. Never committed.
- `data/`: the volume with `db.sqlite3` and the API cache (`.cache/`). Back this up.

Notes:

- Static files are served by WhiteNoise inside Django. This needs no shared volume between
  `web` and `nginx`, and there are only a few files (admin and DRF). Swagger loads its own
  files from a CDN.
- `/admin/` is not routed by nginx on purpose: the app has no admin users.
- nginx sends `CF-Connecting-IP` to Django as `X-Forwarded-For` (overwritten, never appended),
  and Django uses `DRF_NUM_PROXIES=1`, so the rate limits count real visitors.
- nginx only listens on `127.0.0.1:8080` on the host. The public way in is the tunnel.

## 1. Cloudflare tunnel (once)

1. Cloudflare dashboard -> Zero Trust -> Networks -> Tunnels -> **Create a tunnel**.
2. Type: **Cloudflared**. Name: `strollway`.
3. On the "Install connector" page choose **Docker** and copy only the token (the long string
   after `--token`). You do not run the shown command; Compose runs cloudflared.
4. **Public hostname**: subdomain `strollway`, domain `wiktormischker.dev`, path empty,
   service type `HTTP`, URL `nginx:80`.
5. Save. The tunnel shows "Healthy" only after step 3 below.

In SSL/TLS -> Edge Certificates, keep **Always Use HTTPS** on. Django does not redirect HTTP
itself (`SECURE_SSL_REDIRECT=False`), because Cloudflare already does it.

## 2. First setup on the server

Check memory first. The stack adds three containers (about 250-350 MB together):

```bash
free -m
docker stats --no-stream
```

If less than about 300 MB is free, set `GUNICORN_WORKERS=1` in `.env`.

Get the code (only `main` is deployed):

```bash
git clone https://github.com/<your-user>/strollway.git
cd strollway
```

Write `.env`:

```bash
cp .env.production.example .env
nano .env
chmod 600 .env
```

Fill in at least:

```bash
SECRET_KEY=          # generate: python3 -c "import secrets; print(secrets.token_urlsafe(50))"
ALLOWED_HOSTS=strollway.wiktormischker.dev,localhost
CSRF_TRUSTED_ORIGINS=https://strollway.wiktormischker.dev
CLOUDFLARE_TUNNEL_TOKEN=
ORS_API_KEY=
ANTHROPIC_API_KEY=
NVIDIA_API_KEY=
```

`localhost` in `ALLOWED_HOSTS` is needed by the container health check. Set a monthly
spending limit in the Anthropic console.

## 3. Build and start

```bash
docker compose --profile tunnel up -d --build
docker compose ps                # web should be "healthy"
docker compose logs -f web       # migrate, import_places, seed_demo, gunicorn start
```

Check:

- `https://strollway.wiktormischker.dev/` - the app
- `https://strollway.wiktormischker.dev/api/health/` - JSON
- `https://strollway.wiktormischker.dev/api/docs/` - Swagger

## 4. Update after a merge to `main`

```bash
cd strollway
git pull
docker compose --profile tunnel up -d --build
docker image prune -f            # remove old image layers
```

Migrations run on start. The `data/` volume keeps the database between updates.

## 5. Back up the database

SQLite's own backup is safe while the app runs:

```bash
mkdir -p ~/backups
docker compose exec web python -c "import sqlite3; s=sqlite3.connect('/app/var/db.sqlite3'); d=sqlite3.connect('/app/var/backup.sqlite3'); s.backup(d); d.close()"
mv data/backup.sqlite3 ~/backups/strollway-$(date +%F).sqlite3
```

Restore:

```bash
docker compose stop web
cp ~/backups/strollway-YYYY-MM-DD.sqlite3 data/db.sqlite3
docker compose start web
```

## 6. Memory and logs

```bash
docker stats --no-stream         # memory per container
free -m
docker compose logs --tail 100 web
```

## Run the production stack locally

The same stack without the tunnel, with `DEBUG=0`. Put a `.env` with at least `SECRET_KEY`
and `ALLOWED_HOSTS=localhost` next to `docker-compose.yml`, then:

```bash
docker compose up --build
```

Open `http://localhost:8080` (the app), `/api/health/` and `/api/docs/`. Set `NGINX_PORT` to
use another port. Normal development (`runserver` and `npm run dev`) does not change.

## Optional: no Markdown files on the server

The images never contain `*.md` files (see the `.dockerignore` files). If you also do not
want them in the server checkout:

```bash
git sparse-checkout set --no-cone '/*' '!*.md' '!/docs/'
```
