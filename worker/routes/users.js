import { Hono } from 'hono';
import { AREAS, loadUser } from '../auth/permissions.js';
import { requireAdmin } from '../auth/middleware.js';

const users = new Hono();

users.use('*', requireAdmin);

// Deliberately permissive: real addresses vary more than most patterns allow.
// This rejects obvious mistakes, not exotic-but-valid addresses. Bounded to
// 254 chars total, the RFC 5321 practical maximum, so an unbounded
// local-part can't be used to bloat the database or the request.
const EMAIL_MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value) {
  return value.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(value);
}

function normaliseEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * Map an API permissions object to the five database columns.
 *
 * Strict: only a literal `true` sets a flag. Truthy-but-not-boolean input
 * (a non-empty string, an array, an object) must never grant a permission
 * or admin — coercion here previously let `isAdmin: "false"` grant admin.
 */
function toFlags(permissions = {}, isAdmin = false) {
  const on = (value) => (value === true ? 1 : 0);
  return {
    can_blog: on(permissions.blog),
    can_media: on(permissions.media),
    can_merch: on(permissions.merch),
    can_campinfo: on(permissions.campinfo),
    can_design: on(permissions.design),
    is_admin: on(isAdmin),
  };
}

async function audit(db, actorEmail, action, detail) {
  await db.prepare(
    'INSERT INTO audit_log (actor_email, action, detail) VALUES (?, ?, ?)',
  ).bind(actorEmail, action, detail).run();
}

users.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM users ORDER BY email',
  ).all();

  return c.json({
    users: results.map((row) => ({
      email: row.email,
      name: row.name,
      permissions: {
        blog: row.can_blog === 1,
        media: row.can_media === 1,
        merch: row.can_merch === 1,
        campinfo: row.can_campinfo === 1,
        design: row.can_design === 1,
      },
      isAdmin: row.is_admin === 1,
      createdAt: row.created_at,
    })),
  });
});

users.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = normaliseEmail(body.email);

  if (!isValidEmail(email)) {
    return c.json({ error: 'A valid email address is required' }, 400);
  }

  const existing = await c.env.DB
    .prepare('SELECT email FROM users WHERE email = ?').bind(email).first();
  if (existing) {
    return c.json({ error: 'That person already has access' }, 409);
  }

  const flags = toFlags(body.permissions, body.isAdmin);
  try {
    await c.env.DB.prepare(
      `INSERT INTO users
         (email, name, can_blog, can_media, can_merch, can_campinfo,
          can_design, is_admin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      email,
      typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null,
      flags.can_blog, flags.can_media, flags.can_merch,
      flags.can_campinfo, flags.can_design, flags.is_admin,
    ).run();
  } catch (error) {
    // The pre-check above is read-then-write, not atomic: a concurrent POST
    // for the same email can pass it too. Catch the UNIQUE-constraint
    // failure here and answer with the same 409 the pre-check returns,
    // rather than letting the raw D1 error surface as a 500.
    if (String(error?.message ?? error).includes('UNIQUE constraint failed')) {
      return c.json({ error: 'That person already has access' }, 409);
    }
    throw error;
  }

  await audit(c.env.DB, c.get('email'), 'user.create', email);

  return c.json({ user: await loadUser(c.env.DB, email) }, 201);
});

users.patch('/:email', async (c) => {
  const target = normaliseEmail(c.req.param('email'));
  const body = await c.req.json().catch(() => ({}));

  const existing = await c.env.DB
    .prepare('SELECT * FROM users WHERE email = ?').bind(target).first();
  if (!existing) {
    return c.json({ error: 'No such user' }, 404);
  }

  // Locking yourself out of user management is unrecoverable from the
  // panel. Refuse ANY self-demotion attempt, not just a literal `false` —
  // toFlags() is strict, so anything that isn't literal `true` would
  // otherwise coerce to is_admin = 0 and lock the sole admin out with no
  // path back short of a direct database edit.
  if (
    target === c.get('email')
    && body.isAdmin !== undefined
    && body.isAdmin !== true
  ) {
    return c.json({ error: 'You cannot remove your own admin access' }, 400);
  }

  // Merge, never replace: a partial `{ blog: true }` must leave the other
  // three areas untouched. Only an explicit `false` in the body clears one —
  // silence should never revoke access.
  const permissions = {
    blog: existing.can_blog === 1,
    media: existing.can_media === 1,
    merch: existing.can_merch === 1,
    campinfo: existing.can_campinfo === 1,
    design: existing.can_design === 1,
    ...body.permissions,
  };
  const isAdmin = body.isAdmin ?? existing.is_admin === 1;
  const flags = toFlags(permissions, isAdmin);
  const name = body.name === undefined
    ? existing.name
    : (typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null);

  await c.env.DB.prepare(
    `UPDATE users SET name = ?, can_blog = ?, can_media = ?, can_merch = ?,
       can_campinfo = ?, can_design = ?, is_admin = ?, updated_at = unixepoch()
     WHERE email = ?`,
  ).bind(
    name, flags.can_blog, flags.can_media, flags.can_merch,
    flags.can_campinfo, flags.can_design, flags.is_admin, target,
  ).run();

  // Record the resulting state, not just that a change happened — a grant,
  // a revocation, an admin promotion, and a name edit must be
  // distinguishable later from a CLI query against audit_log.
  const detail = `${target} ${JSON.stringify({ permissions, isAdmin: flags.is_admin === 1 })}`;
  await audit(c.env.DB, c.get('email'), 'user.update', detail);

  return c.json({ user: await loadUser(c.env.DB, target) });
});

users.delete('/:email', async (c) => {
  const target = normaliseEmail(c.req.param('email'));

  if (target === c.get('email')) {
    return c.json({ error: 'You cannot remove your own access' }, 400);
  }

  const existing = await c.env.DB
    .prepare('SELECT email FROM users WHERE email = ?').bind(target).first();
  if (!existing) {
    return c.json({ error: 'No such user' }, 404);
  }

  await c.env.DB.prepare('DELETE FROM users WHERE email = ?')
    .bind(target).run();
  await audit(c.env.DB, c.get('email'), 'user.delete', target);

  return c.json({ ok: true });
});

export default users;
