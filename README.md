# TemplateRepository
This repository is the starter for any project, whatever the stack. It carries the conventions and the Supabase tooling; the application code is yours to add.

## Layout

- [`AGENTS.md`](AGENTS.md) — the rules for this project: schema isolation, permissions, Supabase target, approvals, conventions. `CLAUDE.md` only points at it.
- [`Makefile`](Makefile) — task runner. `make help` lists targets.
- `.env` — the four project variables, tracked and secret-free. `.env.local` — secrets, ignored. The migration runner loads both.
- [`scripts/`](scripts/README.md) — task-runner scripts, including the migration runner.
- [`supabase/`](supabase/README.md) — migrations and Edge Functions.
- [`src/`](src/README.md), [`tests/`](tests/README.md), [`data/`](data/README.md), [`assets/`](assets/README.md) — code, tests, data, static files.
- No dependency manifest: add your stack's own. The Supabase CLI comes from the sibling `cloud-key-opener` checkout.

## Starting a new project

1. Create the Supabase project. Set `SUPABASE_PROJECT_REF` and `SUPABASE_PROJECT_LABEL` in `.env`.
2. Set `PROJECT_SCHEMA` and `PROJECT_PREFIX` there too. `AGENTS.md` reads all four and needs no edits.
3. Check the Supabase CLI is reachable: a sibling `cloud-key-opener` checkout, else `npm i --no-save supabase@2.116.0` here. Run `supabase login` if this machine is not authenticated.
4. Add the first migration in `PROJECT_SCHEMA`, check it with `make db-list` and `make db-push-dry`, apply with `make db-push`.
5. Rewrite this README and the folder READMEs for the real project.

## Ground rules

- All new objects live in `PROJECT_SCHEMA` and start with `PROJECT_PREFIX`.
- `public` and `magenhub*` are read-only. Estuary Flow owns them.
- Reads of `public` filter soft deletes: `and "_meta/op" != 'd'`.
- Production writes need explicit approval. See [`AGENTS.md`](AGENTS.md).
