# Source Directory

## Overview
The application's own code. Everything the project does lives here; scripts that only drive tasks belong in [`../scripts/`](../scripts/README.md).

## Structure
- **Entry point**: one file at the top, named by the stack's convention.
- **modules/**: project-specific modules or packages.
- **utils/**: helpers shared across modules.

## Guidelines
- Keep it modular. Name things so the code explains itself; comment the parts that cannot.
- Database access follows [`../AGENTS.md`](../AGENTS.md): `PROJECT_SCHEMA` only, `PROJECT_PREFIX` on every object, `public` read-only, and soft deletes filtered with `and "_meta/op" != 'd'`.
- Never trust a client-supplied broker ID. Filter every query by the user's permitted IDs and check the deny flags.
- Credentials come from the environment, never from committed files.
