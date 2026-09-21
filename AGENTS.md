# Project rules

`PROJECT_SCHEMA`, `PROJECT_PREFIX`, `SUPABASE_PROJECT_REF` and `SUPABASE_PROJECT_LABEL` are set in [`.env`](.env). Read them from there; they are not repeated here. Secrets go in `.env.local`, which is not tracked.

## Supabase target

- Verify the connected project before answering anything about the database.
- Projects here share table names. A wrong ref answers instead of failing.
- No default ref anywhere. Unset stops the run.
- The MCP Supabase server may be bound to another project. Prefer `make db-list` / `make db-push`.
- No staging project. Everything is production.

## Schema isolation

- Build only in `PROJECT_SCHEMA`. Every table, function, view, bucket, policy and Edge Function starts with `PROJECT_PREFIX`.
- Read-only, no exceptions: all of `public` (replicated by Estuary Flow), anything `magenhub_*` or `magenhub-*`, and every schema that is not `PROJECT_SCHEMA`.
- Outside `PROJECT_SCHEMA`: no `INSERT`/`UPDATE`/`DELETE`, no `CREATE`/`ALTER`/`DROP`/`RENAME`. Applies to tables, triggers, RPCs, views, buckets, RLS policies and Edge Functions alike.
- No trigger may write to `public`. It causes Estuary loop failures, lock contention and sync crashes.
- Asked to change a restricted resource: refuse, say `public` and `magenhub` are externally managed and read-only, offer the same thing inside `PROJECT_SCHEMA`.
- Every read of a `public` table filters soft deletes — SQL `and "_meta/op" != 'd'`, JS `.neq('_meta/op', 'd')`. Covers selects, joins and RPCs. Other schemas are unaffected.
- No views. Tables or secured RPCs.
- RLS on every new table. No policies where only the service role reads it.

## Permissions

The permission system is the security boundary on broker financial data. A bypass exposes compensation, revenue and trades across the organisation.

- Filter every query by the user's permitted broker IDs. Never trust a client-supplied ID.
- Check deny flags before returning data: `DenyTradeData`, `DenyPayoutData`, `DenyARNote`, `DenyBrokerageData`, `DenyListBrokerageData`.
- Require the role: `Payout` for payouts, ledger and commission rules; `AccountReceivables` for invoices, credit notes and AR notes; `Admin` for admin.
- Validate any broker or group parameter against the user's scope. Keep report row filters in place.
- Test every permission change: broker sees own data only; group head sees own group only; denied user is blocked; grant recipient sees the grantor, not the grantor's group; `BankPartner` sees AR only.
- Flag anything that could leak broker, trader or client data.
- Read `Permission_Management_Documentation.md` and any `*_DataModel_Documentation.md` in the repo before answering questions on permissions or the data model.

## Production approval

- Before any production write: finish local checks, state target, change and impact, then wait for explicit approval.
- Read-only inspection and local edits need none.
- Covers data, schema, migration history, grants, RLS, functions, deployments, secrets, Auth/Storage and scheduled jobs. Also mail, billable vendor calls and anything writing shared state.
- A fix request or an approved permission prompt is not consent. One scope, one target. Ask again if either changes.

## Database access

- The Management API over HTTPS. The direct Postgres connection fails on this IPv4-only network.
- Use the makefile commands

## Migrations

- `supabase/migrations/<UTC version>_<name>.sql`, targeting `PROJECT_SCHEMA` with `PROJECT_PREFIX` on every object.
- `make db-list`, then `make db-push-dry`, then approval, then `make db-push`. `make help` lists the rest; `db-push` is the only target that writes.
- One transaction records version, name and exact SQL. Plain SQL is wrapped; a single `BEGIN`/`COMMIT` pair takes the insert before `COMMIT`. Other layouts are refused.
- Never rerun an applied migration. Never skip conflicting history.
- After a timeout the write may have committed. Inspect schema and history before retrying; the runner never retries.
- Edge Functions deploy separately. Deploying the frontend deploys neither them nor the database.

## Working conventions

- Update `README.md` in every folder you edit, in the same turn — not parents, not children. Purpose, files and roles, key mechanics, links. Compact bullets, no changelogs. Skip trivial edits and generated folders.
- Extend existing files. Add files only for lasting purposes. Keep plans in the conversation.
- Delete temporary scripts, SQL, logs, caches and tool installs before finishing. Review the final diff for stale references.
- Run the relevant checks, preferring existing tests.
- Never lint, typecheck or format files another session is editing. Scope those to your own changes.
- Secrets live in `.env.local` and Supabase function secrets. Public identifiers may be committed.
