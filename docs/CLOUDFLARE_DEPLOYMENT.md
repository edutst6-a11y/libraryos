# Deploying LibraryOS on Cloudflare

LibraryOS now runs as two Cloudflare deployments instead of Render + Vercel:

- **`worker/`** -- the API, rewritten from the Flask app (`backend/app.py`) to
  a Cloudflare Worker (Hono + TypeScript), talking to the same Postgres
  database through Cloudflare Hyperdrive.
- **`frontend/`** -- the static site, unchanged, deployed to Cloudflare
  Pages instead of Vercel.

The Postgres database itself doesn't move. Hyperdrive connects the Worker to
whatever Postgres instance you already have (Render, Supabase, Neon, RDS,
self-hosted -- doesn't matter), pooling connections the same way a normal
long-lived server would, which is what makes a per-request connection from a
Worker practical.

The old `backend/` (Flask) and its Render `Procfile` are left in the repo
untouched, so you can roll back by pointing `frontend/js/config.js` back at
the Render URL if something goes wrong.

## Prerequisites

- A Cloudflare account, and the connection string for your existing Postgres
  database (the same one `DB_URL`/`DB_HOST` etc. point Render at today).
- Node 18+ and `npm`.
- `npx wrangler login` once, from wherever you run the commands below.

## 1. Deploy the Worker (API)

```bash
cd worker
npm install
npx wrangler login   # if you haven't already
```

Create the Hyperdrive config that points at your existing Postgres:

```bash
npx wrangler hyperdrive create libraryos-db \
  --connection-string="postgres://USER:PASSWORD@HOST:5432/DBNAME"
```

This prints an `id`. Put it into `worker/wrangler.toml`:

```toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "the-id-you-just-got"
```

Set the JWT secret (use the **same value** the Render deployment used for
`JWT_SECRET` if you want any still-valid tokens issued by the old backend to
keep working against the new one -- they're both plain HS256, so a shared
secret is all that's needed for that to just work):

```bash
npx wrangler secret put JWT_SECRET
```

Deploy:

```bash
npm run deploy
```

Wrangler prints the Worker's URL, e.g. `https://libraryos-api.<your-subdomain>.workers.dev`
(or set up a custom domain for it in the Cloudflare dashboard under
Workers & Pages -> your Worker -> Settings -> Triggers).

## 2. Deploy the frontend (Pages)

From the repo root:

```bash
npx wrangler pages deploy frontend --project-name=libraryos
```

This uploads `frontend/` as-is -- no build step needed, it's already static
HTML/CSS/JS. Wrangler prints the resulting `https://libraryos.pages.dev`
URL (or attach a custom domain the same way as the Worker).

## 3. Point the frontend at the Worker

Edit `frontend/js/config.js` and replace the placeholder with your real
Worker URL:

```js
return "https://libraryos-api.YOUR_SUBDOMAIN.workers.dev";
```

Then redeploy Pages (`npx wrangler pages deploy frontend --project-name=libraryos`
again).

## 4. Lock CORS down to your real Pages URL

`worker/wrangler.toml` ships with a placeholder:

```toml
[vars]
CORS_ALLOWED_ORIGIN = "https://libraryos.pages.dev"
```

Update it to your actual Pages URL (or custom domain), then redeploy the
Worker (`npm run deploy`). Comma-separate multiple origins if you need both
a `*.pages.dev` preview URL and a custom domain.

## Database schema

Two tables/columns the app depends on (`report_document`, and
`staff.username`) had been added directly to the production database
outside of any checked-in migration. `sql/05_report_document.sql` and
`sql/06_staff_username.sql` bring the checked-in schema back in sync --
they're safe to run against the existing production database (everything is
`IF NOT EXISTS` / idempotent) and are what a fresh database needs alongside
`sql/01_schema.sql` through `sql/04_auth_schema.sql`.

## Local development

**Worker** (`worker/`): copy `.dev.vars.example` to `.dev.vars`, fill in a
`JWT_SECRET` and a local/dev Postgres connection string, then:

```bash
cd worker
npm install
npm run dev   # http://localhost:8787
```

**Frontend**: serve `frontend/` with any static file server, e.g.
`npx serve frontend`. `frontend/js/config.js` already points `localhost`
traffic at `http://localhost:8787`.

## Decommissioning Render/Vercel

Once you've confirmed the Cloudflare deployment works end-to-end, you can
delete the Render web service and the Vercel project. Nothing in this repo
depends on them anymore once `config.js` points at the Worker.
