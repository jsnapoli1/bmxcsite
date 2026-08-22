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
          modules: true,
          moduleRules: [
            {
              type: 'ESModule',
              include: ['**/*.js'],
              fallthrough: true,
            },
          ],
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
  },
});
