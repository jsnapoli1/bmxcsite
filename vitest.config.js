import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(
        path.join(import.meta.dirname, 'migrations'),
      );
      return {
        miniflare: {
          d1Databases: ['DB'],
          kvNamespaces: ['CONTENT'],
          r2Buckets: ['MEDIA'],
          assets: {
            directory: path.join(import.meta.dirname, 'dist'),
            binding: 'ASSETS',
          },
          bindings: {
            TEST_MIGRATIONS: migrations,
            POLICY_AUD: 'test-audience',
            TEAM_DOMAIN: 'https://test.cloudflareaccess.com',
          },
        },
      };
    }),
  ],
  // JSX in tests compiles to the automatic runtime, which imports
  // jsx-runtime itself. Without this, esbuild emits React.createElement and
  // a test rendering a component fails with "React is not defined" — the
  // app's own JSX only works because vite.config.js supplies the React
  // plugin, and this config does not use it.
  esbuild: {
    jsx: 'automatic',
  },

  test: {
    setupFiles: ['./test/setup.js', './test/setup-kv.js'],
    // Vitest does not restore vi.spyOn mocks between tests by default —
    // a spy created with vi.spyOn(obj, 'fn') in one test keeps its call
    // history and implementation for every later test in the same file
    // unless something resets it. test/worker/cache.test.js re-spies
    // repo.getPublished/getVersion in several `it` blocks without its own
    // afterEach, and without this, the second test in that file inherits
    // the first test's call count on the same underlying spy — a mock
    // asserted to have been "called once" would actually already start
    // at one. restoreMocks fully restores the original implementation
    // after each test, so every vi.spyOn call starts clean.
    restoreMocks: true,
    // Git worktrees live under .worktrees/ and contain a full copy of the
    // tree, tests included. Without this, every test runs twice — once from
    // here and once from each worktree — which doubles the reported count
    // and makes the suite depend on whether a worktree happens to exist.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.worktrees/**'],
  },
});
