# Syncing Production to the CLI Migrations

After you merge `overhaul/01-foundations` into `main`, your **real** Supabase
project needs to catch up to the schema this branch describes. This guide walks
that one-time reconciliation, then the repeatable "push new migrations" flow.

Read it top to bottom the first time. Steps **1–3** are one-time; **4 onward**
are what you'll do for every future schema change.

---

## Why production is a special case

Production was built by **hand-run SQL** (the scripts now archived in
[`legacy_sql/`](legacy_sql/)). This branch rebuilt that same schema as one
clean **baseline migration**, then layered real changes on top:

| Migration | What it does | On prod |
|---|---|---|
| `20240101000000_baseline_schema.sql` | The whole hand-built schema, consolidated | **Already there** — mark as applied, never run |
| `20260615000001_storage_bucket.sql` | Declares the private `hunt-media` bucket (`on conflict do nothing`) | No-op (bucket exists) |
| `20260615000002_data_api_grants.sql` | Grants table privileges to `anon`/`authenticated`/`service_role` | No-op (prod already granted) |
| `20260615000003_drop_storage_quota.sql` | Drops the unused `hunts.storage_used_bytes` column | **Real change** |
| `20260615000004_realtime_feed.sql` | Adds `hunt_check_ins` + `hunt_arrivals` to realtime | **Real change** |
| `20260615000005_check_in_battle_teams.sql` | Many-team battles (`hunt_check_in_teams` join table) | **Real change** |
| `20260615000006_editable_bars.sql` | Editable / manually-added bars | **Real change** |
| `20260617000001_hunt_managers.sql` | Co-managers (`hunt_managers`, `is_hunt_manager()`, RLS swap) | **Real change** |

The trick: tell Supabase the **baseline is already applied** so `db push` skips
it and only runs the seven real migrations after it.

> ⚠️ **Back up first.** In the Supabase dashboard, take a manual backup
> (Database → Backups) before pushing. `db push` is forward-only — there's no
> automatic undo.

---

## Step 0 — Prerequisites

```bash
# You're on main, with the merge in place:
git checkout main && git pull

# The CLI is pinned in the repo; this just confirms it runs:
npx supabase --version
```

You'll need, from the Supabase dashboard:
- your **project ref** (Settings → General → "Reference ID"), and
- the **database password** (Settings → Database) — `link` will prompt for it.

---

## Step 1 — Link this repo to the cloud project (one-time)

```bash
npx supabase link --project-ref <your-project-ref>
```

This stores the connection in `supabase/.temp/` (gitignored). It does **not**
change anything in the database yet.

---

## Step 2 — Mark the baseline as already applied (one-time)

Production already has everything in the baseline, so we record it as "applied"
in prod's migration history **without running it**:

```bash
npx supabase migration repair --status applied 20240101000000
```

Confirm prod now agrees the baseline is done and sees the rest as pending:

```bash
npx supabase migration list
```

You want the baseline showing as applied on **both** Local and Remote, and the
seven `20260615…`/`20260617…` migrations showing as **local-only / pending** on
Remote.

> If `migration list` shows OTHER migrations already applied on remote that you
> don't recognise, **stop and investigate** before pushing — don't force it.

---

## Step 3 — Push the new migrations

```bash
# Optional dry look at what differs from prod:
npx supabase db diff --linked

# Apply the pending migrations to production:
npx supabase db push
```

`db push` prints the exact list it's about to run and asks for confirmation.
You should see the seven migrations from the table above (baseline absent —
that's correct). Confirm.

This is also the **repeatable** step: every future change is a new
`supabase migration new …` file, validated locally with `npx supabase db reset`,
then shipped with `npx supabase db push`. Steps 1–2 never need repeating.

---

## Step 4 — Verify the `hunt-media` storage bucket

The bucket migration is idempotent (`on conflict do nothing`), so on prod it's a
no-op — the bucket you made by hand stays. Just **confirm it's correct**:

- Dashboard → Storage → buckets → `hunt-media` exists.
- It is **Private** (not public) — photos are GDPR-sensitive and served only via
  signed URLs through our `/api/media` proxy.

If it's somehow missing on a fresh project, create it (Storage → New bucket,
name `hunt-media`, **Private**, 10 MiB file-size limit) — or re-run the SQL from
[`20260615000001_storage_bucket.sql`](migrations/20260615000001_storage_bucket.sql)
in the SQL editor.

---

## Step 5 — Confirm the EU region

> ⚠️ GDPR / data residency. The region is fixed at project creation and is
> painful to move later, so this is a *check*, not a fix.

- Dashboard → Settings → General → **Region** should be an EU region
  (e.g. `eu-central-1` / `eu-west-…`).
- If it's **not** EU, the right fix is to create a new EU project and migrate to
  it — don't ignore it.

---

## Step 6 — Verify the Data API grants (migration `20260615000002`)

Without table-level grants to `anon`/`authenticated`/`service_role`, the Data
API and GraphQL return `permission denied for table …` even though RLS is fine.
Prod was already granted, so the migration is a no-op — but verify:

Run in the dashboard SQL editor:

```sql
-- Expect rows for authenticated/anon/service_role (SELECT etc.) on each table:
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('hunts', 'hunt_managers', 'hunt_check_ins')
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;
```

If a table (especially the new `hunt_managers`) shows **no** rows for these
roles, re-run [`20260615000002_data_api_grants.sql`](migrations/20260615000002_data_api_grants.sql)
— it grants existing tables and sets default privileges for future ones.

---

## Sanity-check checklist

Tick these after pushing. Most are one SQL query in the dashboard editor.

- [ ] **Migrations** — `npx supabase migration list` shows all eight applied on
      Remote (baseline + seven).
- [ ] **New table** — `select to_regclass('public.hunt_managers');` returns the
      table (not null).
- [ ] **Helper functions** —
      `select proname from pg_proc where proname in ('is_hunt_manager','is_hunt_participant','find_account_by_email');`
      returns all three.
- [ ] **RLS swap** —
      `select count(*) from pg_policies where schemaname='public' and (coalesce(qual,'') like '%is_hunt_manager%' or coalesce(with_check,'') like '%is_hunt_manager%');`
      returns ~19 (the co-manager policies).
- [ ] **Owner-only kept** — the only `creator_id` policies left are hunt
      insert/delete + the `hunt_managers` add/remove:
      `select tablename, policyname from pg_policies where schemaname='public' and (coalesce(qual,'')||coalesce(with_check,'')) like '%creator_id%';`
- [ ] **Dropped column** — `hunts` no longer has `storage_used_bytes`
      (`select column_name from information_schema.columns where table_name='hunts';`).
- [ ] **Realtime** — `hunt_check_ins` and `hunt_arrivals` are in the
      `supabase_realtime` publication
      (`select tablename from pg_publication_tables where pubname='supabase_realtime';`).
- [ ] **Storage** — `hunt-media` bucket exists and is **Private**.
- [ ] **Region** — project is in an **EU** region.
- [ ] **Grants** — Step 6 query returns rows for the Data API roles.
- [ ] **Smoke test (the real proof)** — open the live app:
      - a host can sign in (Google OAuth) and load the dashboard,
      - a player can join with a code and the feed/photos load,
      - a host can add a co-manager by email and it appears on that account's
        dashboard.

If every box is ticked, prod matches the branch. From here on, schema changes
are just: new migration → `db reset` locally → `db push`.
