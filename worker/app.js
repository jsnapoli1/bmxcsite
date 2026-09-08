import { Hono } from 'hono';
import { requireAuth } from './auth/middleware.js';
import me from './routes/me.js';
import users from './routes/users.js';
import content from './routes/content.js';
import publicContent from './routes/public.js';
import media, { publicMedia } from './routes/media.js';
import blog, { publicBlog } from './routes/blog.js';
import vedit, { publicVedit } from './routes/vedit.js';
import shop, { publicShop } from './routes/shop.js';
import emailRoutes from './routes/email.js';
import subscribeRoutes from './routes/subscribe.js';
import facesRoutes from './routes/faces.js';
import registrationRoutes from './routes/registration.js';
import registrationAdmin from './routes/registration-admin.js';

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
// Proxied to the OpenShop worker; see worker/routes/shop.js.
app.route('/api/admin/shop', shop);
app.route('/api/admin/email', emailRoutes);
// Face tagging. The service is not deployed; without FACE_ORIGIN the
// proxied routes report 503 while the roster half still works.
app.route('/api/admin/faces', facesRoutes);
app.route('/api/admin/registrations', registrationAdmin);

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
app.route('/api/shop', publicShop);
// Public, unauthenticated on purpose: a parent subscribing has no
// account, and an unsubscribe link that required signing in would not be
// an unsubscribe link. Mounted outside /api/admin/*, so requireAuth
// above does not apply.
app.route('/api', subscribeRoutes);
// Public: a guardian filling in a registration has no account. The
// reference in the URL is the credential.
app.route('/api/registration', registrationRoutes);
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
/**
 * Merch lives at shop.bmxc.camp. These paths are how people get there.
 *
 * This used to redirect only once the store had stock, falling back to an
 * informational merch page while the catalogue was empty. The store is
 * stocked and is now the single place merch is described and sold, so the
 * conditional is gone: a page that says "cash only, sold at camp" beside a
 * storefront that ships is two answers to the same question.
 *
 * `/store` and `/shop` are here because they are what people type. Without
 * them the SPA fallback would serve index.html and the router would render
 * the 404 page for a URL that plainly means the store.
 *
 * Server-side rather than in the React app so there is no flash of the wrong
 * page, and so it still works for a visitor whose JavaScript has not run.
 *
 * 302, not 301: a permanently-cached redirect is unusually hard to take back
 * — it lives in browsers this deploy will never reach again — and where the
 * store lives is not a promise worth making irreversible.
 */
const SHOP_PATHS = ['/merch', '/store', '/shop'];

for (const path of SHOP_PATHS) {
  app.get(path, (c) => {
    const origin = c.env.SHOP_ORIGIN;
    // Without SHOP_ORIGIN there is nowhere to send anyone, so fall through
    // to the React page rather than redirect to undefined.
    if (!origin) return c.notFound();
    return c.redirect(origin, 302);
  });
}

app.get('/admin', (c) =>
  c.env.ASSETS.fetch(new Request(new URL('/admin.html', c.req.url), c.req.raw)));
app.get('/admin/*', (c) =>
  c.env.ASSETS.fetch(new Request(new URL('/admin.html', c.req.url), c.req.raw)));

app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
