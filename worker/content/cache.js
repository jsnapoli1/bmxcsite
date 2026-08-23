/**
 * Read-through KV cache in front of the content repository, so the public
 * site never issues a D1 read for content directly.
 *
 * The cache key embeds the content version: `content:<area>:v<version>`.
 * This is deliberate, not incidental. `publishArea` (repository.js) bumps
 * `content_version` in the same batch that flips rows to published, so the
 * very next `cachedContent` call misses on a brand-new key regardless of
 * whether `purge` below ran or succeeded. A failed purge only wastes an
 * orphaned KV entry that expires on its own (`expirationTtl`) — it can
 * never cause stale content to be served, because nothing ever reads the
 * old key again. Collapsing this to a plain `content:<area>` key plus a
 * delete-on-publish would trade that guarantee for a cosmetic tidy: a
 * dropped or failed delete would then serve stale content indefinitely.
 *
 * Cost of the design: `getVersion` runs at least one small D1 query on
 * every call, even on a cache hit. That's expected and intentional — it's
 * cheap compared to the full content query it replaces.
 *
 * A hit is re-verified against the version, not trusted outright. The
 * version can only ever move forward, and it can move between the first
 * `getVersion` call and the KV read (a publish racing a request). Trusting
 * a stale hit in that window would serve content that was true a moment
 * ago but is no longer published. So on a hit, `getVersion` is called
 * again: if it still matches, the hit is genuine; if it moved, this call
 * refetches under the new key instead of returning what's now stale data
 * that merely happened to still be sitting under the old key.
 */

import { getPublished, getVersion } from './repository.js';

const CACHE_TTL_SECONDS = 86400;

function cacheKey(area, version) {
  return `content:${area}:v${version}`;
}

async function readThrough(env, area, version) {
  const content = await getPublished(env.DB, area);
  await env.CONTENT.put(cacheKey(area, version), JSON.stringify(content), {
    expirationTtl: CACHE_TTL_SECONDS,
  });
  return content;
}

/**
 * Returns the published content for `area`, reading through to the
 * repository on a cache miss and populating KV for subsequent reads.
 */
export async function cachedContent(env, area) {
  const version = await getVersion(env.DB, area);
  const cached = await env.CONTENT.get(cacheKey(area, version));

  if (cached === null) {
    return readThrough(env, area, version);
  }

  // Re-check freshness before trusting the hit — see the module comment.
  const currentVersion = await getVersion(env.DB, area);
  if (currentVersion !== version) {
    return readThrough(env, area, currentVersion);
  }

  return JSON.parse(cached);
}

/**
 * Best-effort delete of the current cache entry for `area`. Never throws:
 * a publish must succeed even if the cache delete fails, because the
 * version bump (not this delete) is what guarantees the next read is
 * fresh.
 */
export async function purge(env, area) {
  try {
    const version = await getVersion(env.DB, area);
    await env.CONTENT.delete(cacheKey(area, version));
  } catch {
    // Swallowed intentionally — see function comment above.
  }
}
