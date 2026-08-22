import { Hono } from 'hono';
import { AREAS, loadUser } from '../auth/permissions.js';
import { requireAdmin } from '../auth/middleware.js';

const users = new Hono();

users.use('*', requireAdmin);

// Deliberately permissive: real addresses vary more than most patterns allow.
// This rejects obvious mistakes, not exotic-but-valid addresses.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normaliseEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** Map an API permissions object to the five database columns. */
function toFlags(permissions = {}, isAdmin = false) {
  return {
    can_blog: permissions.blog ? 1 : 0,
    can_media: permissions.media ? 1 : 0,
    can_merch: permissions.merch ? 1 : 0,
    can_campinfo: permissions.campinfo ? 1 : 0,
    is_admin: isAdmin ? 1 : 0,
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
      },
      isAdmin: row.is_admin === 1,
      createdAt: row.created_at,
    })),
  });
});

users.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = normaliseEmail(body.email);

  if (!EMAIL_PATTERN.test(email)) {
    return c.json({ error: 'A valid email address is required' }, 400);
  }

  const existing = await c.env.DB
    .prepare('SELECT email FROM users WHERE email = ?').bind(email).first();
  if (existing) {
    return c.json({ error: 'That person already has access' }, 409);
  }

  const flags = toFlags(body.permissions, body.isAdmin);
  await c.env.DB.prepare(
    `INSERT INTO users
       (email, name, can_blog, can_media, can_merch, can_campinfo, is_admin)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    email,
    typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null,
    flags.can_blog, flags.can_media, flags.can_merch,
    flags.can_campinfo, flags.is_admin,
  ).run();

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

  // Locking yourself out of user management is unrecoverable from the panel.
  if (target === c.get('email') && body.isAdmin === false) {
    return c.json({ error: 'You cannot remove your own admin access' }, 400);
  }

  const permissions = body.permissions ?? {
    blog: existing.can_blog === 1,
    media: existing.can_media === 1,
    merch: existing.can_merch === 1,
    campinfo: existing.can_campinfo === 1,
  };
  const isAdmin = body.isAdmin ?? existing.is_admin === 1;
  const flags = toFlags(permissions, isAdmin);
  const name = body.name === undefined
    ? existing.name
    : (typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null);

  await c.env.DB.prepare(
    `UPDATE users SET name = ?, can_blog = ?, can_media = ?, can_merch = ?,
       can_campinfo = ?, is_admin = ?, updated_at = unixepoch()
     WHERE email = ?`,
  ).bind(
    name, flags.can_blog, flags.can_media, flags.can_merch,
    flags.can_campinfo, flags.is_admin, target,
  ).run();

  await audit(c.env.DB, c.get('email'), 'user.update', target);

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
