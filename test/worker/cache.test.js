import { describe, it, expect, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { cachedContent, purge } from '../../worker/content/cache.js';
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
    vi.spyOn(repo, 'getPublished')
      .mockResolvedValueOnce({ groups: [{ title: 'v1', members: [] }] })
      .mockResolvedValueOnce({ groups: [{ title: 'v2', members: [] }] });
    vi.spyOn(repo, 'getVersion')
      .mockResolvedValueOnce(1).mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);

    expect((await cachedContent(env, 'staff')).groups[0].title).toBe('v1');
    expect((await cachedContent(env, 'staff')).groups[0].title).toBe('v2');
  });

  it('purge does not throw when the key is absent', async () => {
    await expect(purge(env, 'merch')).resolves.toBeUndefined();
  });
});
