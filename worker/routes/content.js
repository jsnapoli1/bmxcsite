import { Hono } from 'hono';
import { requireArea } from '../auth/middleware.js';
import {
  getAll, getPublished, saveArea, publishArea, UnknownAreaError, AREAS_WITH_CONTENT,
} from '../content/repository.js';
import { purge } from '../content/cache.js';
import { validatePayload } from '../content/validation.js';

const content = new Hono();

/**
 * Content areas map to permission areas: staff, faq, and campinfo are all
 * gated by the single `campinfo` permission; merch has its own. This is a
 * deliberate many-to-one mapping, not a mistake — `requireArea` checks
 * against the four permission columns in `worker/auth/permissions.js`
 * (`AREAS`), which does not include `staff` or `faq` as permissions.
 *
 * Built from AREAS_WITH_CONTENT (the repository's own source of truth for
 * "what areas exist") rather than hand-listing the keys a second time, so a
 * future area added there cannot silently go unmapped here — see
 * guardByArea below for what happens when one does.
 */
const PERMISSION_FOR_CONTENT_AREA = Object.fromEntries(
  AREAS_WITH_CONTENT.map((area) => [area, area === 'merch' ? 'merch' : 'campinfo']),
);

async function audit(db, actorEmail, action, detail) {
  await db.prepare(
    'INSERT INTO audit_log (actor_email, action, detail) VALUES (?, ?, ?)',
  ).bind(actorEmail, action, detail).run();
}

/**
 * Applies the correct requireArea(...) guard for :area before the route
 * handler runs.
 *
 * Two distinct "no permission entry" cases, handled differently:
 *
 * - `area` is not in AREAS_WITH_CONTENT at all (genuinely unknown, e.g. a
 *   typo'd URL): let the request through unchecked. There is no permission
 *   to check for a thing that doesn't exist, and the handler's
 *   UnknownAreaError catch turns this into a 404.
 *
 * - `area` IS in AREAS_WITH_CONTENT but has no entry in
 *   PERMISSION_FOR_CONTENT_AREA (drift: a new area added to the repository
 *   without updating this map): FAIL CLOSED with 403. A prior version of
 *   this guard treated both cases identically ("no mapping -> let it
 *   through"), which is safe today only because the two lists happen to
 *   match. Proven unsafe empirically: adding an area to AREAS_WITH_CONTENT
 *   without mapping it here, then PUTting to it as a merch-only editor,
 *   produced a 500 (a NOT NULL/shape failure downstream) instead of a 403 —
 *   the permission gate had already waved the request through. Deriving
 *   the map from AREAS_WITH_CONTENT (above) makes this drift impossible for
 *   existing areas; this branch is the backstop for the day the derivation
 *   itself doesn't cover a new case.
 */
async function guardByArea(c, next) {
  const area = c.req.param('area');
  if (!AREAS_WITH_CONTENT.includes(area)) {
    await next();
    return;
  }
  const permission = PERMISSION_FOR_CONTENT_AREA[area];
  if (!permission) {
    return c.json({ error: 'Forbidden' }, 403);
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

  // A body that failed to parse (empty, truncated, wrong Content-Type, a
  // dropped connection) must never be coerced into `{}` and treated as an
  // instruction to replace the area with nothing. saveArea() REPLACES
  // rather than merges, so "we could not read the body" and "the editor
  // wants every row deleted" must not be indistinguishable — a caller who
  // sent no usable body is told exactly that, not "ok".
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Request body must be valid JSON' }, 400);
  }

  // A well-formed but wrong-shaped payload (missing the area's expected top
  // -level key, an entry that would violate a NOT NULL column) is rejected
  // here too, before saveArea() queues any DELETEs. Deleting every row in an
  // area must be an explicit, well-formed request (e.g. `{ "groups": [] }`),
  // never the default outcome of a malformed one.
  const validationError = validatePayload(area, body);
  if (validationError) {
    return c.json({ error: validationError }, 400);
  }

  try {
    await saveArea(c.env.DB, area, body, c.get('email'));
  } catch (error) {
    if (error instanceof UnknownAreaError) {
      return c.json({ error: 'Unknown content area' }, 404);
    }
    throw error;
  }

  // A save can empty an area (an explicit `{ groups: [] }` is a legitimate,
  // intentional edit). That must leave a trace the same way create/update/
  // delete do for users — see worker/routes/users.js's audit() calls.
  await audit(c.env.DB, c.get('email'), 'content.save', area);

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
