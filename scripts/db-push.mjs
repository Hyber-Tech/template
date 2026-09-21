/** Migration push over the IPv4-compatible Management API, with atomic history. */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
for (const file of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(join(ROOT, file));
  } catch {
    // Absent file: the guards below report anything actually missing.
  }
}
/**
 * The project migrations are applied to.
 *
 * THERE IS NO DEFAULT REF, ON PURPOSE. Every app owns a different Supabase
 * project, and several of them hold tables with the SAME names — a migration
 * sent to the wrong one does not error, it succeeds. So the ref comes from
 * `.env`, which the Makefile loads into the process, or from the environment,
 * and an unset variable stops the run instead of guessing.
 */
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF?.trim();
const MIGRATIONS_DIR = join(ROOT, "supabase/migrations");
const PROJECT_LABEL = process.env.SUPABASE_PROJECT_LABEL?.trim() || PROJECT_REF;
/** What every log line calls the target, readable even before a ref is pinned. */
const TARGET = PROJECT_REF
  ? `${PROJECT_LABEL} (${PROJECT_REF})`
  : "the target project (SUPABASE_PROJECT_REF unset)";
const normalize = (sql) => sql.replace(/\r\n/g, "\n");

/** Parse whole JSON values, retaining array brackets and rejecting malformed rows. */
export function parseRows(stdout) {
  const text = stdout.replace(/\u001b\[[0-9;]*m/g, "").trim();
  const start = text.search(/^[\t ]*[\[{]/m);
  if (start < 0) throw new Error("No JSON result in CLI output (expected --output json)");
  const value = text.slice(start).trimStart();
  const end = value.lastIndexOf(value[0] === "[" ? "]" : "}");
  const parsed = JSON.parse(value.slice(0, end + 1));
  const rows = Array.isArray(parsed) ? parsed : parsed?.rows;
  if (
    !Array.isArray(rows) ||
    rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))
  ) {
    throw new Error("Expected a JSON array of row objects or an object containing rows");
  }
  return rows;
}

function cliCommand() {
  // Global AGENTS.md names the authenticated sibling CLI. No npx version drift.
  for (const directory of [join(ROOT, "../cloud-key-opener"), ROOT]) {
    const launcher = join(directory, "node_modules/supabase/dist/supabase.js");
    if (existsSync(launcher)) return [process.execPath, [launcher]];
  }
  throw new Error(
    "Supabase CLI missing. Install supabase@2.116.0 in cloud-key-opener or this repository, then run supabase login.",
  );
}

function query(sql) {
  if (!PROJECT_REF)
    throw new Error(
      "SUPABASE_PROJECT_REF is not set. Pin this repository's project ref in .env, or pass it on the command line for one-off work against another project.",
    );
  const [command, prefix] = cliCommand();
  const directory = mkdtempSync(join(tmpdir(), "db-push-"));
  try {
    const path = join(directory, "query.sql");
    writeFileSync(path, sql, "utf8");
    const result = spawnSync(
      command,
      [
        ...prefix,
        "db",
        "query",
        "--linked",
        "--project-ref",
        PROJECT_REF,
        "--output",
        "json",
        "--file",
        path,
      ],
      {
        cwd: ROOT,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        timeout: 120_000,
        // Placeholder only avoids the login-role prompt; CLI login authenticates.
        env: { ...process.env, SUPABASE_DB_PASSWORD: "unused-for-management-api" },
      },
    );
    if (result.error) throw new Error(`Could not run Supabase CLI: ${result.error.message}`);
    if (result.status !== 0)
      throw new Error(`Supabase CLI failed:\n${result.stderr || result.stdout}`);
    try {
      return parseRows(result.stdout);
    } catch (cause) {
      throw new Error(
        `Supabase CLI: ${cause.message}\nstdout: ${result.stdout.slice(0, 400)}\nstderr: ${result.stderr || "(empty)"}`,
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function localMigrations(directory = MIGRATIONS_DIR) {
  const versions = new Set();
  return readdirSync(directory)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => {
      const match = /^(\d+)_(.+)\.sql$/.exec(file);
      if (!match) throw new Error(`${file} is not named <version>_<name>.sql`);
      if (versions.has(match[1])) throw new Error(`Duplicate local migration version: ${match[1]}`);
      versions.add(match[1]);
      return {
        file,
        version: match[1],
        name: match[2],
        sql: readFileSync(join(directory, file), "utf8"),
      };
    });
}

/** Mask comments and quoted bodies, preserving offsets for transaction detection. */
function sqlStructure(sql) {
  let masked = "";
  for (let i = 0; i < sql.length;) {
    const start = i;
    if (sql.startsWith("--", i)) {
      const end = sql.indexOf("\n", i);
      i = end < 0 ? sql.length : end;
    } else if (sql.startsWith("/*", i)) {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth) {
        if (sql.startsWith("/*", i)) {
          depth++;
          i += 2;
        } else if (sql.startsWith("*/", i)) {
          depth--;
          i += 2;
        } else i++;
      }
      if (depth) throw new Error("Unterminated SQL comment");
    } else if (sql[i] === "'" || sql[i] === '"') {
      const quote = sql[i++];
      const escaped = quote === "'" && /(?:^|[^\w$])[eE]$/.test(sql.slice(0, start));
      let closed = false;
      while (i < sql.length) {
        if (escaped && sql[i] === "\\") {
          i += 2;
          continue;
        }
        if (sql[i++] === quote) {
          if (sql[i] === quote) i++;
          else {
            closed = true;
            break;
          }
        }
      }
      if (!closed) throw new Error("Unterminated SQL quote");
    } else {
      const tag = /^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/.exec(sql.slice(i))?.[0];
      if (!tag) {
        masked += sql[i++];
        continue;
      }
      const end = sql.indexOf(tag, i + tag.length);
      if (end < 0) throw new Error("Unterminated SQL dollar quote");
      i = end + tag.length;
    }
    masked += " ".repeat(i - start);
  }
  return masked;
}

function literal(value) {
  return "E'" + value.replace(/\\/g, "\\\\").replace(/'/g, "''") + "'";
}

/** Preserve exact file SQL and put its history insert before an existing COMMIT. */
export function applySql(migration) {
  const { sql, version, name } = migration;
  const statements = [...sqlStructure(sql).matchAll(/[^;]+(?:;|$)/g)]
    .map((match) => ({
      text: match[0].replace(/;$/, "").trim(),
      start: match.index,
    }))
    .filter((statement) => statement.text);
  const controls = statements.filter(({ text }) =>
    /^(?:begin|start\s+transaction|commit|end|rollback|abort|prepare\s+transaction)\b/i.test(text),
  );
  const wrapped =
    controls.length === 2 &&
    controls[0] === statements[0] &&
    controls[1] === statements.at(-1) &&
    /^(?:begin|start\s+transaction)(?:\s+(?:work|transaction))?$/i.test(controls[0].text) &&
    /^(?:commit|end)(?:\s+(?:work|transaction))?$/i.test(controls[1].text);
  if (controls.length && !wrapped)
    throw new Error(
      `${migration.file}: unsupported transaction boundaries; use one BEGIN/COMMIT wrapper or none`,
    );
  /*
   * CREATED IF ABSENT, because a virgin project has no ledger at all — the schema
   * and table are made by whichever tool applies the first migration. The shape
   * matches what the Supabase CLI itself creates, so a project stood up this way
   * stays readable by the CLI's own migration commands afterwards. On an existing
   * project every clause is a no-op.
   */
  const ensureLedger =
    "create schema if not exists supabase_migrations;\n" +
    "create table if not exists supabase_migrations.schema_migrations (\n" +
    "  version text not null primary key,\n" +
    "  statements text[],\n" +
    "  name text\n" +
    ");\n";
  const ledger = `\n${ensureLedger}insert into supabase_migrations.schema_migrations (version, name, statements)\nvalues (${literal(version)}, ${literal(name)}, array[${literal(sql)}]);\nnotify pgrst, 'reload schema';\n`;
  // Concatenation avoids replacement-string interpretation of SQL dollar sequences.
  const execution = wrapped
    ? sql.slice(0, controls[1].start) + ledger + sql.slice(controls[1].start)
    : "begin;\n" + sql + "\n;\n" + ledger + "commit;";
  return execution + `\n;\nselect ${literal(version)} as applied_version;\n`;
}

/**
 * `allowEmpty` is ONLY for a project whose ledger table does not exist yet.
 *
 * An empty ledger on a project that HAS one means the read went wrong, and
 * replaying every migration against a populated database on the strength of it
 * would be destructive — hence the default refusal, which the tests pin. A
 * ledger that is absent entirely is a different fact, established by the caller
 * catching `42P01`, and there it genuinely means nothing has been applied.
 */
export function remoteVersions(rows, baseline, allowEmpty = false) {
  if (!rows.length && allowEmpty) return new Set();
  if (!rows.length)
    throw new Error("The migration ledger came back empty; refusing to replay local migrations.");
  if (rows.some((row) => typeof row.version !== "string" || !/^\d+$/.test(row.version))) {
    throw new Error(
      "Invalid migration version in ledger response; refusing to infer pending migrations.",
    );
  }
  const versions = new Set(rows.map((row) => row.version));
  if (baseline && !versions.has(baseline))
    throw new Error(
      `The ledger is missing baseline ${baseline}; check the target project and history.`,
    );
  return versions;
}

export function verifyRecorded(rows, migration) {
  const row = rows[0];
  if (
    rows.length !== 1 ||
    row.version !== migration.version ||
    row.name !== migration.name ||
    !Array.isArray(row.statements) ||
    row.statements.length !== 1 ||
    typeof row.statements[0] !== "string" ||
    normalize(row.statements[0]) !== normalize(migration.sql)
  ) {
    throw new Error(
      `${migration.file}: recorded version, name or SQL differs from the local file. Inspect history before retrying.`,
    );
  }
}

export function main(args = process.argv.slice(2), runQuery = query, local = localMigrations()) {
  if (args.includes("--help")) {
    console.log("Usage: node scripts/db-push.mjs [--dry-run] [--list] [<version or name>]");
    return;
  }
  const unknown = args.filter(
    (arg) => arg.startsWith("-") && !["--dry-run", "--list"].includes(arg),
  );
  const selectors = args.filter((arg) => arg && !arg.startsWith("-"));
  if (unknown.length || selectors.length > 1)
    throw new Error(
      "Use --dry-run, --list, and at most one migration version or name. Unknown arguments are refused.",
    );
  const wanted = selectors[0];
  const selected = wanted
    ? local.filter((m) => m.version === wanted || m.file.includes(wanted))
    : local;
  if (wanted && selected.length !== 1)
    throw new Error(
      `"${wanted}" matches ${selected.length} migrations; specify one exact version or name.`,
    );
  /*
   * AN EMPTY MIGRATIONS FOLDER IS NOT A FAILURE. A repository started from the
   * template has one, and `make db-list` there must exit 0 rather than report an
   * error that says nothing is wrong. Naming a migration that does not exist is
   * still an error — that check runs above, on the selector.
   */
  if (!local.length) {
    console.log("No local migrations yet. Add one under supabase/migrations/.");
    return;
  }
  /*
   * A VIRGIN PROJECT HAS NO LEDGER, and that is not an error.
   *
   * `supabase_migrations.schema_migrations` is created by the first migration
   * the CLI applies, so a brand-new project answers this read with
   * `42P01: relation does not exist` — which aborted the runner before it could
   * report that every local migration was pending. Standing a fresh project up
   * is precisely when this tool is most useful, so an absent ledger is read as
   * "nothing applied yet" and the schema is created below alongside the first
   * migration. Any OTHER failure still throws: an unreachable project and an
   * empty one must not look alike.
   */
  let ledgerRows;
  try {
    ledgerRows = runQuery(
      "set transaction read only;\nselect version from supabase_migrations.schema_migrations;",
    );
  } catch (cause) {
    if (!/42P01|does not exist/i.test(String(cause.message))) throw cause;
    console.log(
      `ledger: none on ${TARGET} — treating every migration as pending`,
    );
    ledgerRows = null;
  }
  /* No ledger means no baseline to check against either: the baseline guard exists
     to catch a ledger belonging to the WRONG project, and an absent one cannot. */
  const remote = remoteVersions(
    ledgerRows ?? [],
    ledgerRows ? local[0].version : null,
    !ledgerRows,
  );
  // Suppressed when the ledger was absent: that case already said so, and said
  // it more usefully than "0 recorded version(s)" does.
  if (!args.includes("--dry-run") && ledgerRows)
    console.log(`ledger: ${remote.size} recorded version(s) on ${TARGET}`);
  if (args.includes("--list")) {
    for (const migration of selected)
      console.log(`  ${remote.has(migration.version) ? "applied" : "pending"}  ${migration.file}`);
    return;
  }
  if (wanted && remote.has(selected[0].version))
    throw new Error(`${selected[0].file} is already recorded as applied. Nothing to do.`);
  const plan = selected.filter((migration) => !remote.has(migration.version));
  if (!plan.length) {
    console.log(`Nothing pending. ${local.length} local migration(s), all recorded.`);
    return;
  }
  // Prepare every file before the first write, also on a dry run.
  const prepared = plan.map((migration) => ({ migration, execution: applySql(migration) }));
  console.log(`${TARGET} — ${plan.length} migration(s) to apply:`);
  for (const migration of plan) console.log(`  ${migration.file}`);
  if (args.includes("--dry-run")) return;
  for (const { migration, execution } of prepared) {
    console.log(`Applying ${migration.file} to ${TARGET} ...`);
    try {
      runQuery(execution);
      verifyRecorded(
        runQuery(
          `set transaction read only;\nselect version, name, statements from supabase_migrations.schema_migrations where version = ${literal(migration.version)};`,
        ),
        migration,
      );
    } catch (cause) {
      throw new Error(
        `${migration.file}: ${cause.message}\nStopped. A request may have committed even if its response failed. Inspect schema and history before retrying; this script does not retry writes.`,
      );
    }
    console.log("Applied and verified exact migration history.");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
