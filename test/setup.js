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
 * Delete order matters now that foreign keys exist. `payments` references
 * `registrations`, and `media.album_id` references `albums`, so a delete
 * in sqlite_master order can fail with SQLITE_CONSTRAINT_FOREIGNKEY —
 * which it did, the first time a table with a real FK was added.
 *
 * `PRAGMA foreign_keys = OFF` does not help: D1's batch() runs in an
 * implicit transaction, and SQLite ignores that pragma inside one.
 *
 * So the order is derived, not hardcoded — each table's foreign keys are
 * read from `pragma_foreign_key_list` and the tables topologically sorted
 * so children are emptied before their parents. Adding a table with a new
 * reference needs no edit here.
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

  // Which tables each table points at, so children can be emptied first.
  const dependencies = new Map();
  for (const { name } of tables) {
    const { results } = await env.DB.prepare(
      `SELECT "table" AS parent FROM pragma_foreign_key_list(?)`,
    ).bind(name).all();
    dependencies.set(name, new Set(results.map((row) => row.parent)));
  }

  // Depth-first: emit a table only once everything it references has been
  // emitted, then reverse — children first. `visiting` breaks a cycle
  // rather than recursing forever; a self-referencing table just gets an
  // arbitrary position, which is fine for a full wipe.
  const ordered = [];
  const seen = new Set();
  const visiting = new Set();
  const visit = (name) => {
    if (seen.has(name) || visiting.has(name)) return;
    visiting.add(name);
    for (const parent of dependencies.get(name) ?? []) {
      if (dependencies.has(parent)) visit(parent);
    }
    visiting.delete(name);
    seen.add(name);
    ordered.push(name);
  };
  for (const { name } of tables) visit(name);
  ordered.reverse();

  await env.DB.batch([
    ...ordered.map((name) => env.DB.prepare(`DELETE FROM ${name}`)),
    // AUTOINCREMENT counters live in sqlite_sequence and would otherwise
    // keep climbing across tests. D1 doesn't allow an unscoped delete on
    // this table, so clear the counter for each discovered table by name.
    ...tables.map(({ name }) =>
      env.DB.prepare('DELETE FROM sqlite_sequence WHERE name = ?').bind(name)),
  ]);
});
