/**
 * Talks to the OpenShop worker that backs the merch store.
 *
 * OpenShop runs as its own deployment (its own repo, its own KV, its own
 * Stripe keys) and is reached over HTTP. That separation is deliberate:
 * OpenShop is AGPL-3.0, and copying it into this repo would put this site
 * under the same licence, including an obligation to offer source to anyone
 * who uses it over a network. Calling a separate service does not.
 *
 * It also keeps two different auth models apart. OpenShop authenticates with
 * a shared admin password exchanged for a 24-hour session token; this site
 * uses Cloudflare Access with per-person permissions in D1. The password
 * never reaches a browser — this module holds it server-side and the panel
 * only ever talks to our own authenticated routes.
 */

/** OpenShop issues 24h tokens; refresh early so a request never races expiry. */
const TOKEN_TTL_MS = 86_400_000;
const REFRESH_BEFORE_MS = 60 * 60 * 1000;

/**
 * Cached session token, per worker isolate.
 *
 * An isolate is short-lived and there may be many, so this is a best-effort
 * optimisation rather than a shared session: the worst case is a few extra
 * logins, which OpenShop rate-limits at 5 per 15 minutes per IP. That limit
 * is why this caches at all — a login on every admin request would trip it.
 */
let cached = null;

export class ShopError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ShopError';
    this.status = status;
  }
}

function shopConfig(env) {
  const origin = env.SHOP_ORIGIN;
  const password = env.SHOP_ADMIN_PASSWORD;
  if (!origin || !password) {
    // Deliberately vague to the caller; specific in the log. A response that
    // named the missing variable would tell an attacker how we are wired.
    console.error('Shop is not configured: SHOP_ORIGIN or SHOP_ADMIN_PASSWORD is unset');
    throw new ShopError('The store is not configured', 503);
  }
  return { origin: origin.replace(/\/$/, ''), password };
}

/**
 * Exchange the admin password for a session token, reusing a cached one while
 * it is comfortably inside its lifetime.
 */
async function sessionToken(env, { force = false } = {}) {
  const { origin, password } = shopConfig(env);

  if (!force && cached && cached.expiresAt - REFRESH_BEFORE_MS > Date.now()) {
    return cached.token;
  }

  const response = await fetch(`${origin}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    // OpenShop rate-limits login attempts; surfacing 503 rather than the
    // upstream 401 avoids implying the *caller* failed to authenticate when
    // in fact this server did.
    console.error(`Shop login failed with ${response.status}`);
    throw new ShopError('Could not reach the store', 503);
  }

  const body = await response.json().catch(() => null);
  const token = body?.token;
  if (!token) {
    console.error('Shop login returned no token');
    throw new ShopError('Could not reach the store', 503);
  }

  cached = { token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return token;
}

/**
 * Call an OpenShop admin endpoint on behalf of an already-authorised person.
 *
 * `path` is everything after `/api/admin` — this function owns the prefix so
 * a caller cannot redirect the request somewhere else in the API.
 *
 * A 401 is retried once with a fresh token: our cached token can be
 * invalidated by an OpenShop redeploy or a KV expiry we cannot see, and that
 * should cost a retry rather than an error the editor has to explain.
 */
export async function shopAdminFetch(env, path, init = {}) {
  const { origin } = shopConfig(env);

  const send = async (token) => fetch(`${origin}/api/admin${path}`, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      'X-Admin-Token': token,
    },
    body: init.body,
  });

  let response = await send(await sessionToken(env));
  if (response.status === 401) {
    response = await send(await sessionToken(env, { force: true }));
  }
  return response;
}

/** Only for tests: drop the cached token so each case starts clean. */
export function resetShopSession() {
  cached = null;
}
