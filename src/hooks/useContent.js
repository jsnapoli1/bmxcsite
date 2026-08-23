import { useEffect, useState } from 'react';

/**
 * Read published content for an area, falling back to the module bundled at
 * build time.
 *
 * The fallback renders first and is replaced only when a fetch succeeds, so
 * an API outage degrades to the content that shipped with the build rather
 * than to a blank page.
 */
export function useContent(area, fallback) {
  const [content, setContent] = useState(fallback);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/content/${area}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => { if (!cancelled) setContent(data); })
      .catch(() => { /* keep the bundled fallback */ })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [area]);

  return { content, isLoading };
}
