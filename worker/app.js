import { Hono } from 'hono';
import { requireAuth } from './auth/middleware.js';
import me from './routes/me.js';
import users from './routes/users.js';
import content from './routes/content.js';
import publicContent from './routes/public.js';
import media, { publicMedia } from './routes/media.js';
import blog, { publicBlog } from './routes/blog.js';
import vedit, { publicVedit } from './routes/vedit.js';

const app = new Hono();

app.onError((err, c) => {
  // Operators need the stack; callers get nothing that describes our internals.
  console.error(`Unhandled error: ${err?.stack ?? err}`);
  return c.json({ error: 'Something went wrong' }, 500);
});

// Every admin API route is authenticated. Mount before the 404 catch-all.
app.use('/api/admin/*', requireAuth);
app.route('/api/admin/me', me);
app.route('/api/admin/users', users);
app.route('/api/admin/content', content);
app.route('/api/admin/media', media);
app.route('/api/admin/blog', blog);
app.route('/api/admin/vedit', vedit);

// Deliberately a different prefix, NOT under /api/admin/*: the public site
// must be able to read published content/media/blog with no Access token
// at all.
//
// publicBlog MUST be routed before publicContent: publicContent registers
// `GET /:area` at `/api/content`, which would otherwise swallow
// `/api/content/blog` as area = "blog" (a genuinely unknown content area,
// answering 404) before Hono ever tries the more specific blog routes.
app.route('/api/content/blog', publicBlog);
app.route('/api/vedit', publicVedit);
app.route('/api/content', publicContent);
app.route('/media', publicMedia);

app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

// SPA fallback would otherwise serve the public index.html here.
//
// These two look duplicated but aren't safely collapsible on this Hono
// version (4.13.3): app.get(['/admin', '/admin/*'], handler) was tried and
// broke the wildcard match — /admin/anything fell through to the static
// asset handler below and 404'd. Left as two explicit registrations rather
// than risk that regressing silently.
app.get('/admin', (c) =>
  c.env.ASSETS.fetch(new Request(new URL('/admin.html', c.req.url), c.req.raw)));
app.get('/admin/*', (c) =>
  c.env.ASSETS.fetch(new Request(new URL('/admin.html', c.req.url), c.req.raw)));

app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
