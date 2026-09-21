# Migrations Directory

## Overview

The schema's source of truth. One forward-only SQL file per change, applied in version order by [`../../scripts/db-push.mjs`](../../scripts/README.md) and recorded in `supabase_migrations.schema_migrations`.

Empty in a fresh repository. That is fine — `make db-list` exits 0 and says so.

## Naming

- `<version>_<name>.sql`, version = UTC `YYYYMMDDHHMMSS`. `supabase migration new <name>` generates both.
- Any other name is rejected, as are two files sharing a version.
- The oldest file is the baseline. If the remote ledger lacks it, the run aborts rather than assume the history is this project's.

## Writing one

- Target `PROJECT_SCHEMA` only. Prefix every object with `PROJECT_PREFIX`.
- Never touch `public` or `magenhub*` — read-only, replicated by Estuary Flow.
- No trigger may write to `public`.
- No views. Enable RLS on new tables.
- Plain SQL, or one `BEGIN`/`COMMIT` pair. Other layouts are refused before anything runs.
- Prefer `if not exists` / `or replace`. Never edit an applied file — add a new one.
- No credentials here.

## Applying

- `make db-list`, then `make db-push-dry`, then `make db-push` after approval. It writes production.
- `make db-push <version or name>` applies one file.
- If a push fails mid-file, the request may have committed. Inspect schema and ledger before retrying. The runner never retries writes.
- Migrations belonging to other apps on the project are left alone.
