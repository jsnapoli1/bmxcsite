import { Hono } from 'hono';
import { cachedContent } from '../content/cache.js';
import { UnknownAreaError } from '../content/repository.js';

/**
 * The public content route. Deliberately mounted at a prefix outside
 * `/api/admin/*` (see worker/app.js) — this route must be reachable with no
 * Access token at all. It serves published content only, via the KV
 * read-through cache; there is no draft path here.
 */
const publicContent = new Hono();

publicContent.get('/:area', async (c) => {
  const area = c.req.param('area');
  try {
    const content = await cachedContent(c.env, area);
    return c.json(content);
  } catch (error) {
    if (error instanceof UnknownAreaError) {
      return c.json({ error: 'Unknown content area' }, 404);
    }
    throw error;
  }
});

export default publicContent;
