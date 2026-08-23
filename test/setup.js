import { beforeEach } from 'vitest';
import { env, applyD1Migrations } from 'cloudflare:test';

/**
 * Give every test an empty database.
 *
 * `@cloudflare/vitest-plugin` isolates D1 storage per test *file*, not per
 * test, and `applyD1Migrations` only runs migrations that have not run yet —
 * so it creates the tables once and then does nothing. Without the delete
 * below, rows written by one test are visible to the next, and tests pass or
 * fail depending on the order they happen to run in.
 *
 * Verified: two tests in one file, the first inserting a row, the second
 * counting — the second saw the first test's row.
 *
 * The table list is discovered from sqlite_master rather than hardcoded.
 * A hardcoded list is a hazard: later phases add tables, and a forgotten
 * line here silently reintroduces the exact cross-test leakage this file
 * exists to prevent. `sqlite_%`, `d1_%`, and `_cf_%` are SQLite/D1-internal
 * tables (not application data, and D1 refuses writes to some of them —
 * e.g. `_cf_METADATA` — with SQLITE_AUTH), so they're excluded.
 *
 * No FK constraints exist today, so delete order across tables is not
 * significant. If a later migration adds `PRAGMA foreign_keys` enforcement
 * and FK columns, this batch will need explicit ordering (children before
 * parents) instead of relying on sqlite_master's return order.
 */
beforeEach(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

  const { results: tables } = await env.DB.prepare(
    `SELECT name FROM sqlite_master
     WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%'
       AND name NOT LIKE 'd1_%'
       AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'`,
  ).all();

  await env.DB.batch([
    ...tables.map(({ name }) => env.DB.prepare(`DELETE FROM ${name}`)),
    // AUTOINCREMENT counters live in sqlite_sequence and would otherwise
    // keep climbing across tests. D1 doesn't allow an unscoped delete on
    // this table, so clear the counter for each discovered table by name.
    ...tables.map(({ name }) =>
      env.DB.prepare('DELETE FROM sqlite_sequence WHERE name = ?').bind(name)),
  ]);
});
