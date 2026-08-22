import { Hono } from 'hono';
import { requireAuth } from './auth/middleware.js';
import me from './routes/me.js';

const app = new Hono();

// Every admin API route is authenticated. Mount before the 404 catch-all.
app.use('/api/admin/*', requireAuth);
app.route('/api/admin/me', me);

app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
