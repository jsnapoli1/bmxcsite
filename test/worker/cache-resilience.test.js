import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { cachedContent } from '../../worker/content/cache.js';
import { saveArea, publishArea } from '../../worker/content/repository.js';

/**
 * The cache exists to keep D1 off the public read path. It must never be
 * able to break the page it speeds up: every KV failure mode has to degrade
 * to a slower-but-correct read, never to an error a visitor sees.
 */
const GROUPS = {
  groups: [{ group: 'Directors', members: [{ name: 'Ken', role: 'D', bio: 'b' }] }],
};

async function publishStaff() {
  await saveArea(env.DB, 'staff', GROUPS, 'x@y.com');
  await publishArea(env.DB, 'staff', 'x@y.com');
}

const withCache = (overrides) => ({
  ...env,
  CONTENT: { get: async () => null, put: async () => {}, delete: async () => {}, ...overrides },
});

describe('the cache never breaks a page read', () => {
  it('survives a failed cache write', async () => {
    await publishStaff();
    const content = await cachedContent(
      withCache({ put: async () => { throw new Error('KV write down'); } }),
      'staff',
    );
    expect(content.groups[0].group).toBe('Directors');
  });

  it('survives a failed cache read', async () => {
    await publishStaff();
    const content = await cachedContent(
      withCache({ get: async () => { throw new Error('KV read down'); } }),
      'staff',
    );
    expect(content.groups[0].group).toBe('Directors');
  });

  it('survives a corrupted cache entry', async () => {
    await publishStaff();
    const content = await cachedContent(
      withCache({ get: async () => 'not json{{{' }),
      'staff',
    );
    expect(content.groups[0].group).toBe('Directors');
  });

  it('survives every KV operation failing at once', async () => {
    await publishStaff();
    const content = await cachedContent(
      withCache({
        get: async () => { throw new Error('down'); },
        put: async () => { throw new Error('down'); },
      }),
      'staff',
    );
    expect(content.groups[0].group).toBe('Directors');
  });
});
