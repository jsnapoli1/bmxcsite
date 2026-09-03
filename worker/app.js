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
 * Send /merch to the store, but only once the store has something to sell.
 *
 * While the catalogue is empty — which is the state until products are added
 * and Stripe keys exist — this falls through to the informational merch page,
 * which is still accurate: merch is sold in person at camp, cash only. A
 * redirect to an empty storefront would lose that and offer nothing instead.
 *
 * Server-side rather than in the React app so there is no flash of the wrong
 * page, and no redirect at all for a visitor whose JavaScript has not run.
 *
 * 302, not 301: this flips based on stock, and a permanently-cached redirect
 * would strand browsers on the store the first time it ever sold out.
 */
let stockedUntil = 0;
let stocked = false;

/** Only for tests: forget the cached stock check between cases. */
export function resetShopStockCache() {
  stockedUntil = 0;
  stocked = false;
}

app.get('/merch', async (c, next) => {
  const origin = c.env.SHOP_ORIGIN;
  if (!origin) return next();

  // Cached for a minute per isolate. Without it every visit to /merch waits
  // on a second network round trip before rendering anything — a real cost on
  // a page most people reach from the nav. A minute is short enough that
  // adding the first product takes effect while you are still looking.
  if (Date.now() < stockedUntil) {
    return stocked ? c.redirect(origin, 302) : next();
  }

  try {
    const response = await fetch(`${origin.replace(/\/$/, '')}/api/products`);
    if (!response.ok) return next();
    const products = await response.json();
    stocked = Array.isArray(products) && products.length > 0;
    stockedUntil = Date.now() + 60_000;
    if (stocked) return c.redirect(origin, 302);
  } catch (error) {
    // The store being unreachable must not take the merch page with it.
    console.error(`Shop check failed for /merch: ${error?.message ?? error}`);
  }

  return next();
});

app.get('/admin', (c) =>
  c.env.ASSETS.fetch(new Request(new URL('/admin.html', c.req.url), c.req.raw)));
app.get('/admin/*', (c) =>
  c.env.ASSETS.fetch(new Request(new URL('/admin.html', c.req.url), c.req.raw)));

app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
