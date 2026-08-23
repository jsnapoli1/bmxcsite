import { Hono } from 'hono';
import { requireAuth } from './auth/middleware.js';
import me from './routes/me.js';
import users from './routes/users.js';

const app = new Hono();

// Every admin API route is authenticated. Mount before the 404 catch-all.
app.use('/api/admin/*', requireAuth);
app.route('/api/admin/me', me);
app.route('/api/admin/users', users);

app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

// SPA fallback would otherwise serve the public index.html here.
app.get('/admin', (c) =>
  c.env.ASSETS.fetch(new Request(new URL('/admin.html', c.req.url), c.req.raw)));
app.get('/admin/*', (c) =>
  c.env.ASSETS.fetch(new Request(new URL('/admin.html', c.req.url), c.req.raw)));

app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
