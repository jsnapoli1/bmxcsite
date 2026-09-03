/**
 * The Cloudflare Email Routing API, wrapped.
 *
 * Two scopes, which is easy to get wrong: routing *rules* belong to a
 * zone, but the *destination addresses* they forward to belong to the
 * account and are shared by every zone on it. That is why this module
 * offers no way to delete a destination — doing so could break routing on
 * a domain that has nothing to do with this camp.
 *
 * The zone is fixed here rather than taken from a request. Nothing a
 * caller sends can point these writes at another zone.
 *
 * This module is the allowlist. It exposes five operations and no generic
 * passthrough, so a capability is added by writing a function, not by
 * Cloudflare shipping a route.
 */

const ZONE_ID = '44fe4c68ed1014b250436a9d9b0c61b2'; // bmxc.camp
const DOMAIN = 'bmxc.camp';
const API = 'https://api.cloudflare.com/client/v4';

export class RoutingError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   */
  constructor(message, status) {
    super(message);
    this.name = 'RoutingError';
    this.status = status;
  }
}

// Deliberately simple: local@domain.tld with no spaces. A sanity check
// before spending a round trip, not an RFC 5322 parser — Cloudflare
// validates properly on its side.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function call(env, path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${env.CF_API_TOKEN}`,
        'content-type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Never interpolate the request or its init into this message: the
    // headers carry the credential, and this message reaches a browser.
    throw new RoutingError('Could not reach Cloudflare.', 502);
  }

  const payload = await res.json().catch(() => null);

  if (!res.ok || payload?.success === false) {
    const message = payload?.errors?.[0]?.message ?? 'Cloudflare rejected that request.';
    throw new RoutingError(message, res.ok ? 400 : res.status);
  }

  return payload.result;
}

/** The literal 'to' address a rule matches, or null for the catch-all. */
function addressOf(rule) {
  const matcher = rule.matchers?.find((m) => m.type === 'literal' && m.field === 'to');
  return matcher?.value ?? null;
}

function shape(rule) {
  return {
    id: rule.id,
    name: rule.name,
    address: addressOf(rule),
    destination: rule.actions?.[0]?.value?.[0] ?? null,
    enabled: rule.enabled,
  };
}

/**
 * Every address rule on the zone.
 *
 * The catch-all is filtered out: it has no literal 'to' matcher, and it is
 * what keeps mail to an unknown address from vanishing. Showing it as a
 * row would invite someone to delete it.
 */
export async function listRules(env) {
  const result = await call(env, `/zones/${ZONE_ID}/email/routing/rules?per_page=100`);
  return (result ?? []).map(shape).filter((rule) => rule.address !== null);
}

export async function createRule(env, { address, destination }) {
  if (!EMAIL.test(String(address ?? ''))) {
    throw new RoutingError('That is not a valid email address.', 400);
  }
  if (!EMAIL.test(String(destination ?? ''))) {
    throw new RoutingError('That is not a valid destination address.', 400);
  }
  if (!String(address).toLowerCase().endsWith(`@${DOMAIN}`)) {
    throw new RoutingError(`An address here must end in @${DOMAIN}.`, 400);
  }

  const rule = await call(env, `/zones/${ZONE_ID}/email/routing/rules`, {
    method: 'POST',
    body: {
      name: String(address).split('@')[0],
      enabled: true,
      matchers: [{ type: 'literal', field: 'to', value: String(address).toLowerCase() }],
      actions: [{ type: 'forward', value: [String(destination)] }],
    },
  });

  return shape(rule);
}

export async function deleteRule(env, id) {
  await call(env, `/zones/${ZONE_ID}/email/routing/rules/${id}`, { method: 'DELETE' });
  return true;
}

/**
 * Account-level destinations. `verified` is a timestamp in the API and a
 * boolean here — the panel only ever needs to know whether mail will
 * actually arrive.
 */
export async function listDestinations(env) {
  const result = await call(
    env,
    `/accounts/${env.CF_ACCOUNT_ID}/email/routing/addresses?per_page=100`,
  );
  return (result ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    verified: Boolean(row.verified),
  }));
}

/**
 * Adds a destination. Cloudflare emails it a verification link; until
 * someone clicks that, forwarding to it silently does not arrive. That is
 * their anti-abuse control and cannot be skipped, which is why the panel
 * shows verification state rather than pretending an address is ready.
 */
export async function createDestination(env, email) {
  if (!EMAIL.test(String(email ?? ''))) {
    throw new RoutingError('That is not a valid email address.', 400);
  }

  const row = await call(env, `/accounts/${env.CF_ACCOUNT_ID}/email/routing/addresses`, {
    method: 'POST',
    body: { email: String(email) },
  });

  return { id: row.id, email: row.email, verified: Boolean(row.verified) };
}
