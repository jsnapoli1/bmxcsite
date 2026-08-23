import { beforeEach } from 'vitest';
import { env } from 'cloudflare:test';

/**
 * Give every test an empty CONTENT namespace.
 *
 * Storage isolation in `@cloudflare/vitest-plugin` is per test *file*, not
 * per test (see https://developers.cloudflare.com/workers/testing/vitest-integration/isolation-and-concurrency/,
 * and `test/setup.js`'s own comment for the same behavior in D1). Without
 * this, a KV key written by one test in a file is still there for the next
 * test in that file, and tests pass or fail depending on execution order
 * rather than their own setup.
 *
 * This is a separate file from `test/setup.js` rather than an addition to
 * it, so the existing, already-relied-upon D1 setup stays untouched.
 */
beforeEach(async () => {
  const { keys } = await env.CONTENT.list();
  await Promise.all(keys.map(({ name }) => env.CONTENT.delete(name)));
});
