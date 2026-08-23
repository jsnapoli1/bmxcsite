import { describe, it, expect } from 'vitest';
import { stripJsonComments } from '../../scripts/jsonc.js';

/**
 * `--remote` seeding rewrites wrangler.jsonc into a temporary config with
 * `remote: true` on the D1 binding, because getPlatformProxy silently falls
 * back to LOCAL state without it. That silence caused a real incident: the
 * safety guard counted rows in the local database while reporting on
 * production, and refused a seed that should have run.
 *
 * The rewrite has to parse a heavily-commented JSONC file. These pin the
 * parsing, since a stripper that mangles the config would take the seed
 * with it.
 */
describe('wrangler.jsonc parsing for the remote seed', () => {
  it('leaves a // inside a string alone', async () => {
    const parsed = JSON.parse(stripJsonComments('{ "url": "https://bmxc.camp" } // trailing'));
    expect(parsed.url).toBe('https://bmxc.camp');
  });

  it('removes line and block comments', async () => {
    const parsed = JSON.parse(stripJsonComments(`{
      // a line comment
      "a": 1, /* a block comment */
      "b": 2
    }`));
    expect(parsed).toEqual({ a: 1, b: 2 });
  });

  it('tolerates a trailing comma', async () => {
    expect(JSON.parse(stripJsonComments('{ "a": 1, }'))).toEqual({ a: 1 });
  });

  it('parses a config shaped like the real wrangler.jsonc', () => {
    // Mirrors the real file's shape: comments above keys, a URL containing
    // "//" inside a string, and a trailing comment. The real file cannot be
    // read here — the suite runs in the Workers runtime, which has no
    // filesystem — so this fixture stands in for it.
    const parsed = JSON.parse(stripJsonComments(`{
      "name": "bmxcsite",
      "main": "./worker/index.js",
      "d1_databases": [
        { "binding": "DB", "database_name": "bmxc" }
      ],
      "vars": {
        "TEAM_DOMAIN": "https://letssimplifai.cloudflareaccess.com"
      },
      // Custom domains. Declared here rather than set in the dashboard so
      // that CI deploys keep them.
      "routes": [
        { "pattern": "bmxc.camp", "custom_domain": true },
        { "pattern": "www.bmxc.camp", "custom_domain": true }
      ]
    }`));

    expect(parsed.name).toBe('bmxcsite');
    expect(parsed.d1_databases[0].binding).toBe('DB');
    // A stripper that ate the "//" in this URL would break Access auth.
    expect(parsed.vars.TEAM_DOMAIN).toBe('https://letssimplifai.cloudflareaccess.com');
    // Custom domains are load-bearing: losing them deploys the site off its
    // own domain.
    expect(parsed.routes).toHaveLength(2);
  });
});
