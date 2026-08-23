import { Hono } from 'hono';
import { requireArea } from '../auth/middleware.js';
import {
  listPosts, getPost, savePost, publishPost, deletePost, BlogError,
} from '../content/blog.js';

/**
 * Admin blog routes. Every route here requires the `blog` permission —
 * mounted in worker/app.js AFTER `app.use('/api/admin/*', requireAuth)`, so
 * a caller reaches these handlers only with a verified identity already
 * attached. `requireArea('blog')` on top of that is what actually gates
 * access; requireAuth alone lets an unregistered-but-verified email through
 * with user = null; see worker/auth/middleware.js.
 *
 * Every route that can throw BlogError maps its `.status` straight through
 * to the response rather than letting it fall to the app-level onError
 * handler, which always answers 500. A malformed save (400) or an unknown
 * slug (404) is caller error, not an operator-facing fault.
 */
const blog = new Hono();

blog.use('*', requireArea('blog'));

async function audit(db, actorEmail, action, detail) {
  await db.prepare(
    'INSERT INTO audit_log (actor_email, action, detail) VALUES (?, ?, ?)',
  ).bind(actorEmail, action, detail).run();
}

// Admin list includes drafts — publishedOnly: false.
blog.get('/', async (c) => {
  const posts = await listPosts(c.env.DB, { publishedOnly: false });
  return c.json({ posts });
});

// Admin get-by-slug also reaches drafts, so an editor can preview/edit one
// before it's published.
blog.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const post = await getPost(c.env.DB, slug, { publishedOnly: false });
  if (post === null) {
    return c.json({ error: 'Not found' }, 404);
  }
  return c.json({ post });
});

blog.put('/:slug', async (c) => {
  const slug = c.req.param('slug');

  // A body that failed to parse must never be coerced into `{}` and
  // treated as a well-formed (if empty) save request — see
  // worker/routes/content.js for the same reasoning applied there.
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Request body must be valid JSON' }, 400);
  }

  try {
    const post = await savePost(c.env.DB, { ...body, slug }, c.get('email'));
    await audit(c.env.DB, c.get('email'), 'blog.save', slug);
    return c.json({ post });
  } catch (error) {
    if (error instanceof BlogError) {
      return c.json({ error: error.message }, error.status);
    }
    throw error;
  }
});

// Creating a new post: no slug in the URL, one is generated from the title.
blog.post('/', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Request body must be valid JSON' }, 400);
  }

  try {
    const post = await savePost(c.env.DB, body, c.get('email'));
    await audit(c.env.DB, c.get('email'), 'blog.save', post.slug);
    return c.json({ post }, 201);
  } catch (error) {
    if (error instanceof BlogError) {
      return c.json({ error: error.message }, error.status);
    }
    throw error;
  }
});

blog.post('/:slug/publish', async (c) => {
  const slug = c.req.param('slug');
  const editorEmail = c.get('email');

  let post;
  try {
    post = await publishPost(c.env, slug, editorEmail);
  } catch (error) {
    if (error instanceof BlogError) {
      return c.json({ error: error.message }, error.status);
    }
    throw error;
  }

  await audit(c.env.DB, editorEmail, 'blog.publish', slug);

  return c.json({ post });
});

blog.delete('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const actorEmail = c.get('email');

  await deletePost(c.env.DB, slug, actorEmail);
  await audit(c.env.DB, actorEmail, 'blog.delete', slug);

  return c.json({ ok: true });
});

export default blog;

/**
 * The public blog routes. Deliberately mounted at `/api/content/blog`, a
 * prefix outside `/api/admin/*` (see worker/app.js) so the public site can
 * read published posts with no Access token at all. Both routes pass
 * `publishedOnly: true` straight through to the storage layer — that flag,
 * not a filter applied here, is what makes a draft impossible to reach:
 * see worker/content/blog.js's getPost/listPosts for the strict status
 * check.
 */
export const publicBlog = new Hono();

// Cache for a short, fixed window rather than immutably: unlike media keys
// (content-addressed, permanently the same bytes once published), a blog
// index or a single post can be edited after publishing, so a public cache
// header here trades a little staleness for fewer D1 reads rather than
// promising bytes never change.
const PUBLIC_CACHE_CONTROL = 'public, max-age=60';

publicBlog.get('/', async (c) => {
  const posts = await listPosts(c.env.DB, { publishedOnly: true });
  return c.json({ posts }, 200, { 'cache-control': PUBLIC_CACHE_CONTROL });
});

publicBlog.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const post = await getPost(c.env.DB, slug, { publishedOnly: true });
  if (post === null) {
    return c.json({ error: 'Not found' }, 404, { 'cache-control': 'no-store' });
  }
  return c.json({ post }, 200, { 'cache-control': PUBLIC_CACHE_CONTROL });
});
