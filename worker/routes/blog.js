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
 *
 * `listPosts`/`getPost` run `SELECT *`, which includes columns a reader has
 * no business seeing — `author_email` (a staff member's address),
 * `id`, `status`, `created_at`, and `updated_at` (internal bookkeeping).
 * The admin routes above return those rows verbatim on purpose: an editor
 * legitimately needs the full row. The public routes below never do —
 * every response here is built through `toPublicPost`, an explicit
 * allowlist projection, rather than trusting the repository to already
 * have the right shape for an anonymous caller.
 */
export const publicBlog = new Hono();

// Cache for a short, fixed window rather than immutably: unlike media keys
// (content-addressed, permanently the same bytes once published), a blog
// index or a single post can be edited after publishing, so a public cache
// header here trades a little staleness for fewer D1 reads rather than
// promising bytes never change.
const PUBLIC_CACHE_CONTROL = 'public, max-age=60';

/**
 * Looks up `alt_text` for a hero image. Returns `null` for a post with no
 * hero image, or if the media row is somehow missing — the caller must
 * not break just because alt text isn't available.
 */
async function getHeroAltText(db, heroMediaKey) {
  if (heroMediaKey === null) return null;
  const row = await db.prepare('SELECT alt_text FROM media WHERE key = ?')
    .bind(heroMediaKey).first();
  return row?.alt_text ?? null;
}

/**
 * Projects a `blog_posts` row down to exactly what an anonymous reader
 * needs. This is an explicit allowlist, not a blocklist — new columns
 * added to the table in the future are excluded by default rather than
 * silently exposed.
 *
 * Named here so intent survives a refactor: this drops `author_email`
 * (a staff member's personal address — the leak this projection exists to
 * close), plus `id`, `status`, `created_at`, and `updated_at`, none of
 * which a reader needs.
 *
 * `heroAltText` is passed in rather than looked up here so callers can
 * batch or share lookups (e.g. across a whole index) instead of the
 * projection making its own DB round trip per post. `includeBody` is
 * false for the index (a reader doesn't need every post's full body just
 * to see the list) and true for a single post.
 */
function toPublicPost(row, heroAltText, includeBody) {
  const base = {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    published_at: row.published_at,
    hero_media_key: row.hero_media_key,
    hero_media_alt: heroAltText,
  };
  return includeBody ? { ...base, body_markdown: row.body_markdown } : base;
}

publicBlog.get('/', async (c) => {
  const posts = await listPosts(c.env.DB, { publishedOnly: true });
  const publicPosts = await Promise.all(
    posts.map(async (post) => toPublicPost(post, await getHeroAltText(c.env.DB, post.hero_media_key), false)),
  );
  return c.json({ posts: publicPosts }, 200, { 'cache-control': PUBLIC_CACHE_CONTROL });
});

publicBlog.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const post = await getPost(c.env.DB, slug, { publishedOnly: true });
  if (post === null) {
    return c.json({ error: 'Not found' }, 404, { 'cache-control': 'no-store' });
  }
  const heroAltText = await getHeroAltText(c.env.DB, post.hero_media_key);
  return c.json({ post: toPublicPost(post, heroAltText, true) }, 200, { 'cache-control': PUBLIC_CACHE_CONTROL });
});
