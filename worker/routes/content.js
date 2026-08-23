import { Hono } from 'hono';
import { requireArea } from '../auth/middleware.js';
import {
  getAll, getPublished, saveArea, publishArea, UnknownAreaError,
} from '../content/repository.js';
import { purge } from '../content/cache.js';

const content = new Hono();

/**
 * Content areas map to permission areas: staff, faq, and campinfo are all
 * gated by the single `campinfo` permission; merch has its own. This is a
 * deliberate many-to-one mapping, not a mistake — `requireArea` checks
 * against the four permission columns in `worker/auth/permissions.js`
 * (`AREAS`), which does not include `staff` or `faq` as permissions.
 */
const PERMISSION_FOR_CONTENT_AREA = {
  staff: 'campinfo',
  faq: 'campinfo',
  merch: 'merch',
  campinfo: 'campinfo',
};

async function audit(db, actorEmail, action, detail) {
  await db.prepare(
    'INSERT INTO audit_log (actor_email, action, detail) VALUES (?, ?, ?)',
  ).bind(actorEmail, action, detail).run();
}

/**
 * Applies the correct requireArea(...) guard for :area before the route
 * handler runs. An unknown area has no permission mapping, so it is
 * deliberately let through here (no permission check makes sense for a
 * thing that doesn't exist) — the handler itself is responsible for
 * turning that into a 404 via UnknownAreaError, never a 500.
 */
async function guardByArea(c, next) {
  const area = c.req.param('area');
  const permission = PERMISSION_FOR_CONTENT_AREA[area];
  if (!permission) {
    await next();
    return;
  }
  return requireArea(permission)(c, next);
}

content.use('/:area', guardByArea);
content.use('/:area/publish', guardByArea);

content.get('/:area', async (c) => {
  const area = c.req.param('area');
  try {
    // getAll() returns the unfiltered (draft) shape; getPublished() returns
    // the published-only shape. The editor view needs both side by side, so
    // both repository reads run here rather than only one.
    const [draft, published] = await Promise.all([
      getAll(c.env.DB, area),
      getPublished(c.env.DB, area),
    ]);
    return c.json({ draft, published });
  } catch (error) {
    if (error instanceof UnknownAreaError) {
      return c.json({ error: 'Unknown content area' }, 404);
    }
    throw error;
  }
});

content.put('/:area', async (c) => {
  const area = c.req.param('area');
  const body = await c.req.json().catch(() => ({}));
  try {
    await saveArea(c.env.DB, area, body, c.get('email'));
  } catch (error) {
    if (error instanceof UnknownAreaError) {
      return c.json({ error: 'Unknown content area' }, 404);
    }
    throw error;
  }
  return c.json({ ok: true });
});

content.post('/:area/publish', async (c) => {
  const area = c.req.param('area');
  let version;
  try {
    version = await publishArea(c.env.DB, area, c.get('email'));
  } catch (error) {
    if (error instanceof UnknownAreaError) {
      return c.json({ error: 'Unknown content area' }, 404);
    }
    throw error;
  }

  await purge(c.env, area);
  await audit(c.env.DB, c.get('email'), 'content.publish', area);

  return c.json({ ok: true, version });
});

export default content;
