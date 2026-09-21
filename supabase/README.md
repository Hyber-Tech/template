# Supabase Directory

## Overview

What this repository owns in its Supabase project. Rules live in [`../AGENTS.md`](../AGENTS.md).

## Structure

- **migrations/**: the schema's source of truth, applied by `make db-push`. See [`migrations/README.md`](migrations/README.md).
- **functions/**: Edge Functions, one folder each. They deploy independently of the database and the frontend.
- **config.toml**: written by `supabase init`. Describes the local CLI stack, not production. Its `project_id` may be a local alias, not the real ref.

## Isolation rules

- All objects go in `PROJECT_SCHEMA` and start with `PROJECT_PREFIX`.
- `public` is replicated by Estuary Flow. Read-only, every table, no exceptions.
- `magenhub_*` and `magenhub-*` are managed elsewhere. Read-only.
- No trigger may write to `public`. It breaks replication.
- Reads of `public` must filter soft deletes: `and "_meta/op" != 'd'`.
- No views. Use tables or secured RPCs.
- Enable RLS on every new table. No policies if only the service role reads it — it bypasses RLS anyway.

## Usage

- `make db-list` — applied/pending, read-only.
- `make db-push-dry` — prepare without applying.
- `make db-push` — apply. Writes production; needs approval.
- `supabase functions deploy <name> --project-ref <ref>` — one function, keeping its auth setting.

Set the project ref in [`../.env`](../.env) first. There is no default.
