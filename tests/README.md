# Tests Directory

## Overview
Automated tests for the codebase: unit, integration, and regression.

## Structure
- **unit/**: tests for individual components.
- **integration/**: tests across components.
- **fixtures/**: shared test data.
- **\*.test.mjs**: offline database tests, run by `make db-test`. None yet — the target says so and exits 0.

## Guidelines
- Write tests for new code where feasible. Keep them current and readable.
- Application tests use your stack's own runner. Add a make target for them; `db-test` covers the database tooling only.
- Database tests run offline. Inject the query function instead of calling a project; use an in-process Postgres (`npm i --no-save @electric-sql/pglite`) if a test needs real SQL.
- Tests never touch a production Supabase project. Anything needing one gets its own named target, never the default run.
- Tests never write outside `PROJECT_SCHEMA`.

## Usage
Run them before finishing a change, and in CI.
