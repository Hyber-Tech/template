# Scripts Directory

## Overview

Task-runner scripts, driven by the root [`Makefile`](../Makefile). Application code goes in [`../src/`](../src/README.md); their tests in [`../tests/`](../tests/README.md).

## Files

- `db-push.mjs`: implements `make db-push`, `make db-push-dry` and `make db-list`. Applies [`../supabase/migrations/`](../supabase/migrations/README.md) and records history atomically.

## How `db-push.mjs` behaves

- The target comes from `SUPABASE_PROJECT_REF` in `.env`, which the runner loads itself along with `.env.local`. **There is no default.** Projects here share table names, so a wrong ref succeeds instead of failing. Neither overrides a variable already set, so `make db-list SUPABASE_PROJECT_REF=other` still wins. Unset stops the run.
- `SUPABASE_PROJECT_LABEL` is printed beside the ref, so a redirected run cannot pose as the usual target.
- Queries use `db query --linked --project-ref ... --output json` over HTTPS. The direct Postgres connection fails on this IPv4-only network.
- It prefers the authenticated CLI in sibling `cloud-key-opener`, then this repo's install. It calls the Node launcher directly, never `npx`, so the version cannot drift.
- The `unused-for-management-api` password exists only in the subprocess environment, to skip the login-role prompt. Not a credential.
- No ledger on the project means nothing has been applied. It is created with the first migration. An *empty* ledger where one exists is refused — that read went wrong, and replaying everything would be destructive.
- An empty migrations folder exits 0. A named migration that does not exist exits 1.
- Files must be `<version>_<name>.sql`. Duplicate versions, unknown flags, ambiguous selectors and reruns of applied migrations are refused.
- Lists and dry runs are read-only. A dry run prepares the SQL; it does not prove it will execute.
- A push prepares every pending file before the first write, then applies them in order. Plain SQL is wrapped in a transaction; one existing `BEGIN`/`COMMIT` pair takes the history insert before `COMMIT`.
- Comments, quoted strings and dollar-quoted bodies are preserved exactly. Each transaction stores the exact SQL, version and name, then reloads the PostgREST cache. Verification rereads all three, normalizing line endings only.
- A failed or timed-out request stops the run. It may already have committed, so inspect before retrying. Temp SQL directories are removed after every query.
- It does not deploy Edge Functions, sync roles, or apply seed files.

## Guidelines

- `make db-push` writes production and needs the approval in [`../AGENTS.md`](../AGENTS.md). Lists and dry runs do not.
- Migrations must stay inside `PROJECT_SCHEMA`, prefixed with `PROJECT_PREFIX`. `public` and `magenhub*` are read-only.
- If you change `db-push.mjs`, add a test under [`../tests/`](../tests/README.md) and keep `make db-test` green. The full offline suite for this runner lives in the `usage-tracker` repository and can be copied in.
