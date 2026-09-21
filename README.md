# Template skeleton
This repository is the starter for any project, whatever the stack. It carries the conventions and the Supabase tooling.

## Layout

- [`AGENTS.md`](AGENTS.md) — the rules for this project: schema isolation, permissions, Supabase target, approvals, conventions.
- [`Makefile`](Makefile) — task runner. `make help` lists targets.
- `.env` — the project variables, tracked and secret-free. `.env.local` — secrets, ignored. The migration runner loads both.
- [`scripts/`](scripts/README.md) — scripts that support the project without being core to its content.
- [`supabase/`](supabase/README.md) — migrations and Edge Functions.
- [`src/`](src/README.md), [`tests/`](tests/README.md), [`data/`](data/README.md), [`assets/`](assets/README.md) — the main code.



## Ground rules

- All new objects live in `PROJECT_SCHEMA` and start with `PROJECT_PREFIX`.
- `public` is read-only. Estuary Flow owns them.
- Reads of `public` filter soft deletes: `and "_meta/op" != 'd'`.
- Production writes need explicit approval. See [`AGENTS.md`](AGENTS.md).
