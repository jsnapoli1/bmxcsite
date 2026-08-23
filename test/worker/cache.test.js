import { describe, it, expect, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { cachedContent, purge } from '../../worker/content/cache.js';
import { saveArea, publishArea } from '../../worker/content/repository.js';
import * as repo from '../../worker/content/repository.js';

describe('cache', () => {
  it('reads through to the repository on a miss', async () => {
    const spy = vi.spyOn(repo, 'getPublished')
      .mockResolvedValue({ groups: [{ title: 'Fresh', members: [] }] });
    const content = await cachedContent(env, 'staff');
    expect(content.groups[0].title).toBe('Fresh');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('serves the second read from cache without touching D1', async () => {
    const spy = vi.spyOn(repo, 'getPublished')
      .mockResolvedValue({ groups: [{ title: 'Cached', members: [] }] });
    await cachedContent(env, 'staff');
    await cachedContent(env, 'staff');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('misses after a version bump, without needing a purge', async () => {
    // Uses the real repository and a real version bump rather than a mocked
    // call sequence. An earlier version of this test chained
    // mockResolvedValueOnce to a fixed call count, which forced the
    // implementation to call getVersion twice per cache hit purely to
    // consume the mock — a wasted D1 query per request to satisfy a test.
    await saveArea(env.DB, 'staff', {
      groups: [{ group: 'v1', members: [{ name: 'Ken', role: 'Director', bio: 'b' }] }],
    }, 'x@y.com');
    await publishArea(env.DB, 'staff', 'x@y.com');

    const first = await cachedContent(env, 'staff');
    expect(first.groups[0].group).toBe('v1');

    // Warm the cache, then publish new content. No purge.
    await cachedContent(env, 'staff');
    await saveArea(env.DB, 'staff', {
      groups: [{ group: 'v2', members: [{ name: 'Ken', role: 'Director', bio: 'b' }] }],
    }, 'x@y.com');
    await publishArea(env.DB, 'staff', 'x@y.com');

    // The version bump alone must be enough to serve the new content.
    const after = await cachedContent(env, 'staff');
    expect(after.groups[0].group).toBe('v2');
  });

  it('purge does not throw when the key is absent', async () => {
    await expect(purge(env, 'merch')).resolves.toBeUndefined();
  });

  it('still returns content when the KV write fails on a miss', async () => {
    vi.spyOn(repo, 'getPublished')
      .mockResolvedValue({ groups: [{ title: 'Unwritable', members: [] }] });

    const brokenEnv = {
      ...env,
      CONTENT: {
        get: env.CONTENT.get.bind(env.CONTENT),
        delete: env.CONTENT.delete.bind(env.CONTENT),
        list: env.CONTENT.list.bind(env.CONTENT),
        put: vi.fn().mockRejectedValue(new Error('KV unavailable')),
      },
    };

    const content = await cachedContent(brokenEnv, 'staff');
    expect(content.groups[0].title).toBe('Unwritable');
  });
});
