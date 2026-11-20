#!/usr/bin/env tsx
/**
 * Backup/restore drill: dumps DATABASE_URL, restores it into a scratch
 * database (RESTORE_CHECK_DATABASE_URL — a throwaway db on the SAME
 * Postgres server or a local one, never a database anyone depends on),
 * and sanity-checks a few row counts match. A backup you've never
 * restored is a backup you don't actually have — run this on a schedule
 * (monthly is reasonable for an event that only runs once a year), not
 * just once at setup.
 *
 * Requires the `pg_dump`/`psql` client binaries on PATH, matching the
 * server's major version. Not run in CI (see .github/workflows/ci.yml) —
 * it's an ops drill, meant to be run by a human against real
 * infrastructure, not a build-time check.
 */
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import "dotenv/config";

const SOURCE_URL = process.env.DATABASE_URL;
const SCRATCH_URL = process.env.RESTORE_CHECK_DATABASE_URL;

if (!SOURCE_URL || !SCRATCH_URL) {
  console.error("Set both DATABASE_URL and RESTORE_CHECK_DATABASE_URL to run this.");
  process.exit(1);
}

const TABLES_TO_COMPARE = ["User", "Profile", "Match", "MatchRound", "Question"];

function run(cmd: string): string {
  return execSync(cmd, { stdio: ["ignore", "pipe", "inherit"] }).toString();
}

function countRows(url: string, table: string): number {
  const out = run(`psql "${url}" -t -c 'SELECT count(*) FROM "${table}";'`);
  return parseInt(out.trim(), 10);
}

async function main() {
  const dir = mkdtempSync(path.join(tmpdir(), "prommatch-restore-check-"));
  const dumpFile = path.join(dir, "dump.sql");

  try {
    console.log("Dumping source database...");
    run(`pg_dump "${SOURCE_URL}" -F c -f "${dumpFile}"`);

    console.log("Restoring into scratch database (this wipes the scratch db first)...");
    run(`psql "${SCRATCH_URL}" -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'`);
    run(`pg_restore -d "${SCRATCH_URL}" "${dumpFile}"`);

    console.log("\nComparing row counts (source vs. restored):");
    let allMatch = true;
    for (const table of TABLES_TO_COMPARE) {
      const sourceCount = countRows(SOURCE_URL!, table);
      const restoredCount = countRows(SCRATCH_URL!, table);
      const ok = sourceCount === restoredCount;
      if (!ok) allMatch = false;
      console.log(`${ok ? "✓" : "✗"} ${table}: ${sourceCount} vs ${restoredCount}`);
    }

    if (!allMatch) {
      console.error("\nRestore check FAILED — counts don't match. Investigate before trusting this backup.");
      process.exit(1);
    }
    console.log("\nRestore check passed.");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

void main();
