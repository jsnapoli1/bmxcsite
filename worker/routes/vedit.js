/**
 * The visual editor's save/publish endpoint, and the public read of
 * published design overrides.
 *
 * Two mounts with deliberately different gates:
 *
 * - `vedit` (this default export) is mounted under /api/admin/*, so it
 *   inherits requireAuth and additionally requires the `design` permission.
 *   This is the only path that can write.
 * - `publicVedit` is mounted outside /api/admin/*, reads the `published`
 *   stage only, and never writes. The public site has no Access token.
 */
import { Hono } from 'hono';
import { createVeditHandler } from 'vedit/server';
import { requireArea } from '../auth/middleware.js';
import { hasPermission } from '../auth/permissions.js';
import { d1Store } from '../vedit/store.js';

const vedit = new Hono();

// Every route on this router requires the design permission on top of the
// requireAuth that /api/admin/* already applies in app.js.
vedit.use('*', requireArea('design'));

async function audit(db, actorEmail, action, detail) {
  await db.prepare(
    'INSERT INTO audit_log (actor_email, action, detail) VALUES (?, ?, ?)',
  ).bind(actorEmail, action, detail).run();
}

/**
 * vedit's handler owns the wire protocol (its own paths, verbs and JSON
 * shapes), so this route hands the raw Request to it rather than
 * re-implementing that surface. What stays ours is authorization.
 *
 * `authorize` is passed explicitly even though requireArea('design') has
 * already run and would reject an unauthorized caller before this point.
 * That is intentional defence in depth, not redundancy: the library treats
 * a missing `authorize` as "every request may write", so an omission here
 * would be silently insecure the moment this handler were ever mounted
 * somewhere less protected. Stating it means the handler carries its own
 * guarantee rather than borrowing one from its mount point.
 */
vedit.all('/*', async (c) => {
  const email = c.get('email');
  const store = d1Store(c.env.DB, email);

  const handle = createVeditHandler({
    store,
    authorize: () => hasPermission(c.get('user'), 'design'),
  });

  const response = await handle(c.req.raw);

  // Audit writes, not reads: the editor polls documents constantly while
  // open, and an audit row per read would drown the log that exists to
  // answer "who changed the site". A 2xx on a mutating verb is the signal
  // that something actually changed.
  const method = c.req.method;
  if (response.ok && method !== 'GET' && method !== 'HEAD') {
    const url = new URL(c.req.url);
    await audit(c.env.DB, email, 'vedit.write', `${method} ${url.pathname}`);
  }

  return response;
});

/**
 * Published design overrides for one page, for the public site.
 *
 * Read-only and published-only by construction: this handler names the
 * stage itself rather than taking it from the query string, so there is no
 * input that could make it serve a draft. Drafts are the whole point of
 * staging — a visitor must never see one.
 */
export const publicVedit = new Hono();

publicVedit.get('/', async (c) => {
  const key = c.req.query('key');
  if (!key) {
    return c.json({ error: 'Missing key' }, 400);
  }

  const doc = await d1Store(c.env.DB).read(key, 'published');

  // A page with no overrides is the normal case, not an error: it means
  // nobody has edited it. `null` tells the provider to render the design as
  // written, which is exactly right.
  return c.json({ document: doc });
});

export default vedit;
