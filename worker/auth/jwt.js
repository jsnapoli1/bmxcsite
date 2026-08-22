import { jwtVerify, createRemoteJWKSet } from 'jose';

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
    this.status = 403;
  }
}

// One JWKS cache per team domain. createRemoteJWKSet caches and refreshes
// the keys internally, so building a new one per request would defeat that.
const jwksCache = new Map();

function jwksFor(teamDomain) {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

/**
 * Verify the Cloudflare Access JWT on a request and return the verified email.
 *
 * Throws AuthError for every failure mode. Callers must not distinguish
 * between them in responses — a caller learning *why* verification failed
 * learns something about our configuration.
 */
export async function verifyAccessJwt(request, env) {
  if (!env.POLICY_AUD || !env.TEAM_DOMAIN) {
    throw new AuthError('Access is not configured');
  }

  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) {
    throw new AuthError('Missing Access token');
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(token, jwksFor(env.TEAM_DOMAIN), {
      issuer: env.TEAM_DOMAIN,
      audience: env.POLICY_AUD,
    }));
  } catch (cause) {
    throw new AuthError('Invalid Access token');
  }

  if (typeof payload.email !== 'string' || !payload.email) {
    throw new AuthError('Access token has no email claim');
  }

  // Emails are matched against the users table, so casing must not decide
  // whether someone is an admin.
  return payload.email.toLowerCase();
}
