/** The four independently grantable content areas. */
export const AREAS = Object.freeze(['blog', 'media', 'merch', 'campinfo']);

/**
 * Load an admin user by email.
 *
 * Returns null when the email has no row. A verified Access identity with no
 * row is a real, expected state: it means someone reached the panel but has
 * not been granted anything yet. Never insert a row here.
 */
export async function loadUser(db, email) {
  const row = await db
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind(String(email).toLowerCase())
    .first();

  if (!row) return null;

  return {
    email: row.email,
    name: row.name,
    permissions: {
      blog: row.can_blog === 1,
      media: row.can_media === 1,
      merch: row.can_merch === 1,
      campinfo: row.can_campinfo === 1,
    },
    isAdmin: row.is_admin === 1,
  };
}

/** Whether `user` may act on `area`. Admins pass every known area. */
export function hasPermission(user, area) {
  if (!user) return false;
  if (!AREAS.includes(area)) return false;
  if (user.isAdmin) return true;
  return user.permissions[area] === true;
}
