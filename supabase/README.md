# Database & Migrations (Supabase)

This is the single source of truth for Chicken Run's database. As of the
overhaul we use the **Supabase CLI with versioned migrations** and a **local
Postgres in Docker**, instead of pasting SQL into the dashboard by hand.

## The mental model

- `migrations/` holds timestamped `.sql` files. They run **in order** to build
  the database from empty. This folder _is_ the schema.
- `migrations/20240101000000_baseline_schema.sql` is the **baseline** — one
  cleaned-up, heavily-commented file equal to the old hand-run `001`–`016`
  scripts (including the messy duplicate `005`/`007` + "catchup" files). Read
  this file when you want to understand the data model. **Never edit it** — it
  represents what production already has.
- Every change from here on is a **new** migration file. Never edit an old one.
- `legacy_sql/` (if present) is the original hand-run scripts, kept for history
  only. The CLI ignores them.

## Everyday commands

All commands use the locally-pinned CLI via `npx`.

```bash
# Start the local stack (Postgres, Auth, Storage, Studio…) and apply migrations
npx supabase start

# See local URLs + keys (API, DB, Studio dashboard)
npx supabase status

# Create a new migration (writes an empty timestamped file in migrations/)
npx supabase migration new short_description_here

# Wipe the local DB and re-apply every migration from scratch (great for testing
# that your migrations build cleanly end-to-end)
npx supabase db reset

# Stop the local stack
npx supabase stop
```

Local endpoints (defaults from `config.toml`):

- API: http://127.0.0.1:54321
- Postgres: postgresql://postgres:postgres@127.0.0.1:54322/postgres
- Studio (DB GUI): http://127.0.0.1:54323

## Pushing to production

Production is **not** touched until you explicitly link and push:

```bash
# One-time: connect this repo to the cloud project (needs project ref + DB pw)
npx supabase link --project-ref <your-project-ref>

# Because prod was built by the OLD hand-run scripts, tell Supabase the baseline
# is already applied there, so it doesn't try to re-run it (one-time):
npx supabase migration repair --status applied 20240101000000

# Check what would change, then push real (new) migrations
npx supabase db diff   # sanity check vs prod
npx supabase db push   # apply pending migrations to prod
```

> ⚠️ GDPR / data residency: keep the cloud project in an **EU region**. It's set
> at project creation and painful to change later.

## GraphQL

The `pg_graphql` extension (enabled in the baseline) auto-exposes a GraphQL API
at `/graphql/v1`, enforcing the same RLS as the tables. The frontend talks to it
through Apollo Client. Custom side-effects (code-join, Places search, image
handling) stay as Nitro endpoints under `server/api/`.
