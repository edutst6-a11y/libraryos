# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

LibraryOS is a library management and usage-analytics web app built as a University of Lusaka Big Data course project. **`docs/LIBRARYOS_SPEC.md` is the complete specification** (roles, every page, the API contract, data model, seed data, content, design system, hosting, production-only data, security notes). Read the relevant section before non-trivial work.

## Commands

There is no test suite and no linter. The only automated check is the Worker typecheck.

```bash
# Cloudflare Worker API (worker/) -- the port that replaces Flask
cd worker && npm install
npm run typecheck                                  # tsc --noEmit
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="postgres://user:pass@localhost:5432/db"
npm run dev                                        # http://localhost:8787; JWT_SECRET goes in worker/.dev.vars
npx wrangler deploy --dry-run --outdir=/tmp/build  # verifies bundling without Cloudflare credentials

# Flask API (backend/) -- what is live on Render today
pip install -r backend/requirements.txt
python backend/app.py                              # http://localhost:5055; reads DB_URL or DB_HOST/DB_USER/..., JWT_SECRET

# Frontend: static files, no build step
npx serve frontend                                 # config.js sends localhost traffic to http://localhost:8787

# Fresh database: run in this order (03 is the query script, not a migration)
for f in 01_schema 02_seed_data 04_auth_schema 05_report_document 06_staff_username; do psql "$DB" -f sql/$f.sql; done
```

The Hyperdrive override must be a real shell environment variable. Wrangler does not read it from `.dev.vars`.

The seed sets no passwords. To log in locally, put a bcrypt `password_hash` on a `staff` or `members` row, and insert a `group_admin` row for the Project Group modal. Insert a `report_document` row for the report page.

Changes are verified by running the API against a database loaded with the seed and calling the endpoints. Known-good values: `/api/stats` returns `collection_rate_pct: 28.9` and `total_loans: 460`.

## Architecture

- **Two backends, one contract.** `backend/app.py` (Flask, live) and `worker/src/` (Hono + postgres.js over Hyperdrive, built but not deployed) implement identical endpoints and JSON. Until Flask is retired, an API change goes into both.
- **Frontend** (`frontend/`) has three pages:
  - `index.html`: login/register over a Three.js scene.
  - `portal.html`: member portal.
  - `dashboard.html`: staff dashboard.
- **`js/app.js`** is a hash router: the `RENDERERS` map at the bottom maps `#view` → a render function that writes `innerHTML` into `#content`. Call `attachTilt()` after inserting new cards.
- Every "Big Data Project" view renders through `bdpMount()`. It supplies the dark showcase shell, the "Prepared by" byline (from public `GET /api/group/members`), the requirement badge and the footer.
- **Auth:**
  - A JWT (HS256) stored in `localStorage` as `lo_token`, with UI info in `lo_account`.
  - `account_type` is `member`, `staff` or `group_admin`.
  - Staff roles grant nothing extra; any staff can switch their own.
  - Worker middleware `authRequired` → `managementRequired` / `groupAdminRequired` mirrors the Flask decorators.
- **Database:** every table is in the Postgres schema `library` (inside a shared database named `mindcare`), so each connection must set `search_path`.
  - Flask runs `SET search_path` per connection.
  - The Worker sends it as a startup parameter in `worker/src/db.ts`.
  - `db.ts` also overrides postgres.js type parsers so JSON matches Flask: `DATE` → `"YYYY-MM-DD"`, `NUMERIC` and `bigint` → numbers.
  - Postgres names unaliased expressions `?column?`, so alias anything read by name.
- The Worker opens one postgres.js client per request (`withDb`) and closes it with `waitUntil`. Hyperdrive does the pooling.
- **SQL safety:** filtered list endpoints (`worker/src/routes/tables.ts`) build `WHERE` clauses only from fixed code fragments with numbered `$n` placeholders, then call `sql.unsafe(text, params)`. Values are always parameters; keep it that way.

## Keep in sync

- The 20 analysis queries exist three times: `sql/03_queries.sql`, `QUERIES` in `backend/app.py`, and `worker/src/routes/queries.ts`.
- `frontend/downloads/` holds byte-identical copies of the `sql/` files and the report PDF, which also exists at the repo root and in `report/`.
- Report, findings, slide and visualisation copy quotes exact seed figures: 28.9% collection rate, K1,814.57 issued / K524.25 collected, "The Last Road" 10 loans, Northmead 140 loans / K151.50, Kitwe 127 / K102.75. The seed is deterministic (`scripts/generate_seed_data.py`, `random.seed(42)`, "today" fixed at 2026-09-08). Changing it means rechecking that copy (spec §9.2).
- The generator scripts in `scripts/` hard-code the original author's laptop paths and a local `mindcare` database login.

## Production

- **Live:** frontend `https://libraryos-tau.vercel.app`, API `https://libraryos-api-ugsj.onrender.com`. Database credentials exist only in Render's environment.
- **Production-only data:** staff usernames and password hashes, the `group_admin` row, `group_members`, every `report_document` version (including edits made in the browser), and members who registered through the app. None of it is in the repo. Run `pg_dump --schema=library` before rebuilding any database (spec §13).
- **Cloudflare deployment:** steps are in `docs/CLOUDFLARE_DEPLOYMENT.md`. Placeholders to fill:
  - the Hyperdrive id in `worker/wrangler.toml`;
  - the Worker URL in `frontend/js/config.js`;
  - `CORS_ALLOWED_ORIGIN` (singular in the Worker; Flask uses `CORS_ALLOWED_ORIGINS`).
