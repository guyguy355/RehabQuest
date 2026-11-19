# Deployment

RehabQuest ships as **one container**: the Node API serves the built web app from the same
origin and runs the reminder/outbox worker in-process. One Postgres database. Nothing else.

```
browser ──https──▶ rehabquest (Node, port 3000)
                     ├─ /            built web app (client/dist, SPA fallback)
                     ├─ /api/*       JSON API
                     ├─ /health      uptime check
                     └─ worker loop  reminders, missed-activity rules, push outbox (every 30 s)
                                │
                                ▼
                          Postgres 16 (DATABASE_URL)
```

Migrations run automatically on every start (`prisma migrate deploy`), so a deploy is:
push to `main` → image builds → migrations apply → new version serves traffic.

## What the server refuses to run without (production only)

With `NODE_ENV=production` the API checks its configuration at startup and exits with a
list of problems instead of running half-working. It requires:

| Variable | Why |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | ≥ 16 random characters; signs login tokens |
| `APP_BASE_URL` | public `https://` address of the app; used in password-reset links |
| `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` | password-reset emails. `log`/`none` are rejected in production |
| `EMAIL_FROM` | sender on a domain verified with Resend, e.g. `RehabQuest <no-reply@clinic.co.il>` |
| `CLIENT_DIST_DIR` *or* `CORS_ORIGIN` | serve the app from the API (set by the Dockerfile) or allow a separate web origin |

Optional: `EMAIL_REPLY_TO`, `WEB_PUSH_PUBLIC_KEY` / `WEB_PUSH_PRIVATE_KEY` / `WEB_PUSH_SUBJECT`
(browser push; generate with `npm run push:keys` in `server/`), `AI_SUMMARY_PROVIDER=anthropic` +
`ANTHROPIC_API_KEY` (model-drafted progress summaries; needs a data-processing agreement first),
`DEFAULT_TIMEZONE`, `AUTH_RATE_LIMIT_MAX`, `WORKER_INTERVAL_MS`.

`DEV_EXPOSE_RESET_TOKENS` and `EXERCISE_DEMO_PREVIEW` must be unset or `false`.

## Option A: Render (recommended first deployment)

`render.yaml` in the repo root describes the whole setup: a Docker web service and a
Postgres instance, both in **Frankfurt** (EU). Steps:

1. Create a [Resend](https://resend.com) account, add and verify your sending domain, create an API key.
2. In Render: **New → Blueprint**, pick the GitHub repo `guyguy355/RehabQuest`, branch `main`.
3. Fill in the prompted values: `APP_BASE_URL` (use the `*.onrender.com` URL Render shows, or your
   own domain after you add it), `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`.
4. Deploy. Watch the logs for `RehabQuest API running` and `Email: provider resend`.
5. Open `https://<your-app>/health` → `{"status":"ok"}`.
6. Create the first therapist account from the Render **Shell** tab of the service:
   ```sh
   cd /app/server && THERAPIST_PASSWORD='choose-a-strong-password' npx tsx scripts/create-therapist.ts --name "Full Name" --email therapist@clinic.co.il
   ```
   (The runtime image includes `tsx`; the script never creates therapists through the public API.)
7. Custom domain: Render → service → Settings → Custom Domains; then set `APP_BASE_URL` to it.

Plans in `render.yaml` are the smallest paid ones (web `starter`, Postgres `basic-256mb`).
Free plans exist but the web service sleeps after inactivity and the free database expires
after 30 days; neither is acceptable for patients.

**Backups:** Render Postgres paid plans take daily snapshots. Verify restore once before go-live
(Render → database → Backups → restore to a new instance).

## Option B: any Docker host (Fly.io, a VPS, Railway)

```sh
docker build -t rehabquest .
docker run -d --name rehabquest -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL='postgresql://…' \
  -e JWT_SECRET='…' \
  -e APP_BASE_URL='https://app.example' \
  -e EMAIL_PROVIDER=resend -e RESEND_API_KEY='re_…' -e EMAIL_FROM='RehabQuest <no-reply@example>' \
  rehabquest
```

Put a TLS-terminating proxy in front (Caddy, nginx, the platform's load balancer). The container
trusts `X-Forwarded-*` headers (`TRUST_PROXY=true`) so rate limiting sees real client IPs.
Keep one instance: the login rate limiter is in-memory per process (a second instance would
need a shared store).

## Local production rehearsal

```sh
docker build -t rehabquest .
docker run --rm -p 3000:3000 --env-file server/.env \
  -e NODE_ENV=production -e APP_BASE_URL=https://localhost:3000 \
  -e EMAIL_PROVIDER=resend -e RESEND_API_KEY=re_test -e EMAIL_FROM='RehabQuest <no-reply@example>' \
  -e DATABASE_URL='postgresql://postgres:postgres@host.docker.internal:5432/rehabquest' rehabquest
```

## Operations checklist

- **Health:** `GET /health` (also used by Render and the Docker `HEALTHCHECK`).
- **Logs:** the API logs `[api] unhandled error`, `[auth] password reset email … was not sent`,
  `[worker] …` lines. No health data is logged.
- **Migrations:** every deploy runs `prisma migrate deploy`. A migration that fails stops the
  deploy and the previous version keeps serving.
- **Rollback:** redeploy the previous image (Render → Deploys → Rollback). Migrations are forward-only;
  write them to be backward compatible with the previous release.
- **Security headers:** CSP, HSTS, nosniff, frame-ancestors none, referrer policy, permissions policy
  are set by the server. Fonts load from Google Fonts; everything else is same-origin.
- **Data export:** any signed-in person can download their data at `GET /api/me/export`
  (audited as `EXPORT_CREATED`).
