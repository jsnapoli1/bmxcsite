import { beforeEach } from 'vitest';
import { env, applyD1Migrations } from 'cloudflare:test';

// Each test file gets isolated storage; re-apply migrations before every test
// so no test can observe rows written by another.
beforeEach(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
