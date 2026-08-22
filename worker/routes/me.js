import { Hono } from 'hono';
import { AREAS } from '../auth/permissions.js';

const me = new Hono();

const NO_PERMISSIONS = Object.fromEntries(AREAS.map((area) => [area, false]));

me.get('/', (c) => {
  const user = c.get('user');

  if (!user) {
    // Verified by Access, but not granted anything in this panel yet.
    return c.json({
      email: c.get('email'),
      name: null,
      permissions: NO_PERMISSIONS,
      isAdmin: false,
      registered: false,
    });
  }

  return c.json({
    email: user.email,
    name: user.name,
    permissions: user.permissions,
    isAdmin: user.isAdmin,
    registered: true,
  });
});

export default me;
