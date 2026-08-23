import { useEffect, useState } from 'react';

/**
 * True when every top-level value in `data` is an empty collection: an
 * empty array, or an object with no keys (recursing one level, since
 * campinfo's shape is `{ fields: {...} }` rather than an array). `null`/
 * `undefined` also count as empty.
 *
 * A 200 response with empty content is indistinguishable from "not seeded
 * yet" — a migrated-but-unseeded database answers every content endpoint
 * with exactly this shape (`{"categories":[]}`, `{"fields":{}}`, etc). The
 * bundled fallback is strictly better than replacing real content with
 * nothing, so this gate keeps the fallback when the API has nothing to say.
 *
 * A payload with even one real entry anywhere is NOT empty — this must
 * never suppress genuine content, only the all-empty case.
 */
function isEmpty(data) {
  if (!data || typeof data !== 'object') return true;
  return Object.values(data).every((value) => {
    if (Array.isArray(value)) return value.length === 0;
    if (value && typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  });
}

/**
 * Read published content for an area, falling back to the module bundled at
 * build time.
 *
 * The fallback renders first and is replaced only when a fetch succeeds AND
 * carries real content, so an API outage or an empty-but-200 response (see
 * `isEmpty`) both degrade to the content that shipped with the build rather
 * than to a blank page.
 */
export function useContent(area, fallback) {
  const [content, setContent] = useState(fallback);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/content/${area}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => { if (!cancelled && !isEmpty(data)) setContent(data); })
      .catch(() => { /* keep the bundled fallback */ })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [area]);

  return { content, isLoading };
}

export { isEmpty };
