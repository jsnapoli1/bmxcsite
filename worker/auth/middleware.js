import { verifyAccessJwt, AuthError } from './jwt.js';
import { loadUser, hasPermission } from './permissions.js';

/**
 * Verify the Access JWT and attach the user to the context.
 *
 * A verified email with no users row is allowed past this middleware with
 * user = null, so /me can tell them they have no access yet. Routes that do
 * anything real must additionally use requireAdmin or requireArea.
 */
export async function requireAuth(c, next) {
  let email;
  try {
    email = await verifyAccessJwt(c.req.raw, c.env);
  } catch (error) {
    if (error instanceof AuthError) {
      // The four AuthError messages (unconfigured, missing token, invalid
      // token, no email claim) are operationally distinct but must never be
      // distinguishable to a caller — that would leak configuration state.
      // Log the real cause for operators; the response says nothing.
      console.error(`Access verification failed: ${error.message}`);
      return c.json({ error: 'Forbidden' }, 403);
    }
    throw error;
  }

  c.set('email', email);
  c.set('user', await loadUser(c.env.DB, email));
  await next();
}

/** Require the caller to be an admin. */
export async function requireAdmin(c, next) {
  const user = c.get('user');
  if (!user?.isAdmin) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  await next();
}

/** Require permission on a specific content area. */
export function requireArea(area) {
  return async function areaGuard(c, next) {
    if (!hasPermission(c.get('user'), area)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  };
}
