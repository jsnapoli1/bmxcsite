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
  test: {
    setupFiles: ['./test/setup.js'],
    // Git worktrees live under .worktrees/ and contain a full copy of the
    // tree, tests included. Without this, every test runs twice — once from
    // here and once from each worktree — which doubles the reported count
    // and makes the suite depend on whether a worktree happens to exist.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.worktrees/**'],
  },
});
