/**
 * The merch store's admin surface, proxied through this worker.
 *
 * The panel calls these routes; they verify the caller the same way every
 * other admin route does (Cloudflare Access via requireAuth in app.js, plus
 * the `merch` permission), then forward to OpenShop with a server-side
 * credential the browser never sees.
 *
 * Two things this buys beyond hiding the password:
 *
 * - **One login.** Whoever manages merch signs in once, through Access, with
 *   the permissions they already have. No second shared password to
 *   circulate, revoke, or leave in a browser.
 * - **Attribution.** Shop writes land in `audit_log` against a real person.
 *   OpenShop's own auth is a single shared account, so on its side every
 *   change looks identical no matter who made it.
 */
import { Hono } from 'hono';
import { requireArea } from '../auth/middleware.js';
import { shopAdminFetch, ShopError } from '../shop/client.js';

const shop = new Hono();

// Merch is merch: the same permission that governs the D1-backed merch
// content governs the store behind it.
shop.use('*', requireArea('merch'));

/**
 * Endpoints this proxy is willing to forward, by method.
 *
 * An allowlist rather than a pass-through. OpenShop's admin API also exposes
 * store settings, media, AI image generation and an agent endpoint; none of
 * those belong to the merch permission, and a blanket proxy would hand all of
 * them to anyone holding it. Adding a capability here should be a deliberate
 * decision, not a side effect of OpenShop shipping a new route.
 */
const ALLOWED = [
  { method: 'GET', pattern: /^\/products$/ },
  { method: 'POST', pattern: /^\/products$/ },
  { method: 'GET', pattern: /^\/products\/[\w-]+$/ },
  { method: 'PUT', pattern: /^\/products\/[\w-]+$/ },
  { method: 'DELETE', pattern: /^\/products\/[\w-]+$/ },
  { method: 'GET', pattern: /^\/collections$/ },
  { method: 'POST', pattern: /^\/collections$/ },
  { method: 'PUT', pattern: /^\/collections\/[\w-]+$/ },
  { method: 'DELETE', pattern: /^\/collections\/[\w-]+$/ },
  { method: 'GET', pattern: /^\/analytics$/ },
];

function isAllowed(method, path) {
  return ALLOWED.some((rule) => rule.method === method && rule.pattern.test(path));
}

async function audit(db, actorEmail, action, detail) {
  await db.prepare(
    'INSERT INTO audit_log (actor_email, action, detail) VALUES (?, ?, ?)',
  ).bind(actorEmail, action, detail).run();
}

shop.all('/*', async (c) => {
  // Everything after /api/admin/shop, which is what OpenShop sees appended
  // to its own /api/admin prefix.
  const path = new URL(c.req.url).pathname.replace(/^\/api\/admin\/shop/, '') || '/';
  const method = c.req.method;

  if (!isAllowed(method, path)) {
    // 404 rather than 403: a route this proxy does not carry may as well not
    // exist, and enumerating what is behind it helps nobody.
    return c.json({ error: 'Not found' }, 404);
  }

  const body = method === 'GET' || method === 'DELETE'
    ? undefined
    : await c.req.text();

  let response;
  try {
    response = await shopAdminFetch(c.env, path, { method, body });
  } catch (error) {
    if (error instanceof ShopError) {
      return c.json({ error: error.message }, error.status);
    }
    throw error;
  }

  // Audit writes, not reads. The panel lists products on every visit; a row
  // per read would bury the ones that record a change.
  if (response.ok && method !== 'GET') {
    await audit(c.env.DB, c.get('email'), 'shop.write', `${method} ${path}`);
  }

  // Pass the upstream body and status through unchanged so the panel sees
  // OpenShop's own validation errors rather than a flattened version.
  const text = await response.text();
  return new Response(text, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
  });
});

export default shop;
