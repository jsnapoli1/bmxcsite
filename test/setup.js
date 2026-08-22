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
 */
beforeEach(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

  // Order matters if foreign keys are added later: children before parents.
  await env.DB.batch([
    env.DB.prepare('DELETE FROM audit_log'),
    env.DB.prepare('DELETE FROM users'),
    // audit_log.id is AUTOINCREMENT, so its counter lives in sqlite_sequence
    // and would otherwise keep climbing across tests.
    env.DB.prepare("DELETE FROM sqlite_sequence WHERE name = 'audit_log'"),
  ]);
});
