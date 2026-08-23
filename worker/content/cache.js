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
 * `getVersion` runs exactly once per `cachedContent` call, including on a
 * hit. One check is sufficient because the version is part of the key,
 * not a separate freshness check on the side: a hit against a key built
 * from version N is, by construction, content that was published at
 * version N. There is nothing to re-verify — if the version had already
 * moved past N, the key for N+1 (or whatever the new version is) is what
 * this call would have looked up instead, and that lookup would miss and
 * read through. The single `getVersion` call is still a small D1 query
 * (cheap compared to the full content query it replaces), but there is no
 * second one to pay for.
 */

import { getPublished, getVersion } from './repository.js';

const CACHE_TTL_SECONDS = 86400;

function cacheKey(area, version) {
  return `content:${area}:v${version}`;
}

async function readThrough(env, area, version) {
  const content = await getPublished(env.DB, area);

  // The cache write is an optimisation, not part of the contract this
  // function exists to fulfil: returning the content that was already
  // successfully read from D1. A KV outage must not turn into a 500 for a
  // page that D1 was perfectly able to serve. If the write fails, the
  // next request simply reads through again — the same degradation as any
  // other cache miss.
  try {
    await env.CONTENT.put(cacheKey(area, version), JSON.stringify(content), {
      expirationTtl: CACHE_TTL_SECONDS,
    });
  } catch (error) {
    console.error(`Content cache write failed for ${area}: ${error.message}`);
  }

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
