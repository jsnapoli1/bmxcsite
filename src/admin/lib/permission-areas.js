/**
 * The permission areas the admin panel offers a toggle for.
 *
 * Mirrors AREAS in worker/auth/permissions.js — the server decides what may
 * be granted; this adds the labels, which are a UI concern the worker has no
 * business naming. Kept in its own module so the cross-check in
 * test/admin/permission-areas.test.js can import it without pulling React
 * into the Workers test runtime.
 *
 * Adding a permission on the server without adding it here leaves it
 * grantable over HTTP and invisible to the person meant to grant it. That
 * has happened once; the test exists so it fails loudly next time.
 */
export const AREAS = Object.freeze([
  { key: 'blog', label: 'Blog posts' },
  { key: 'media', label: 'Photos & videos' },
  { key: 'merch', label: 'Merch' },
  { key: 'campinfo', label: 'Camp info' },
  { key: 'design', label: 'Site design' },
]);

/** Every area off — the starting state for a newly invited user. */
export const EMPTY_PERMISSIONS = Object.freeze(
  Object.fromEntries(AREAS.map((area) => [area.key, false])),
);
