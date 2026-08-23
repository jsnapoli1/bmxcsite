/**
 * Reads and writes blog posts — the site's first content type shaped as
 * independent rows with permanent public URLs, rather than a singleton
 * area replaced wholesale on every save (see worker/content/repository.js
 * for that pattern).
 *
 * Two invariants this module exists to protect:
 *
 * 1. A slug is a permanent public URL. `savePost` generates one from the
 *    title only when creating a new post, and on collision appends
 *    `-2`, `-3`, ... rather than ever reusing (and silently overwriting)
 *    an existing post's slug. Updating an existing post never changes its
 *    slug, even if the title changes.
 * 2. `hero_media_key` may only point at PUBLISHED media once a post is
 *    published. A draft may reference anything — including a still-private
 *    image, while it's being written — but `publishPost` checks the media
 *    row and refuses to publish (throwing `BlogError`) if the hero image
 *    is not public. Referencing a private image from a published post
 *    would leak it, which is the exact exposure the media phase is
 *    designed to prevent.
 *
 * `body_markdown` is stored exactly as written and is never rendered to
 * HTML here — rendering happens at read time (Task 5), so a rendering bug
 * is fixable by changing the renderer, not by a database migration.
 */

export class BlogError extends Error {
  /**
   * @param {string} message
   * @param {400 | 404} status
   */
  constructor(message, status) {
    super(message);
    this.name = 'BlogError';
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// slug generation
// ---------------------------------------------------------------------------

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Finds a slug for `title` that is not already used by any row other than
 * `excludeId` (the row being updated, if any). Starts at the plain
 * slugified title and appends `-2`, `-3`, ... on collision — a slug is a
 * permanent public URL, so this never returns one that would overwrite an
 * existing, different post.
 */
async function generateUniqueSlug(db, title, excludeId) {
  const base = slugify(title);
  let candidate = base;
  let suffix = 1;

  // eslint-disable-next-line no-await-in-loop -- each check depends on the
  // previous candidate; collisions are expected to be rare (0-1 iterations
  // in the common case), so a loop is clearer than a bulk pre-fetch here.
  while (await slugIsTaken(db, candidate, excludeId)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
}

async function slugIsTaken(db, slug, excludeId) {
  const row = excludeId
    ? await db.prepare('SELECT id FROM blog_posts WHERE slug = ? AND id != ?')
      .bind(slug, excludeId).first()
    : await db.prepare('SELECT id FROM blog_posts WHERE slug = ?')
      .bind(slug).first();
  return row !== null;
}

// ---------------------------------------------------------------------------
// listPosts / getPost
// ---------------------------------------------------------------------------

/**
 * Posts newest-first. `publishedOnly: true` restricts to published rows.
 *
 * `id DESC` is a secondary sort key, not decoration: `published_at` and
 * `created_at` are INTEGER Unix seconds, so two posts saved or published
 * within the same second tie on the primary column. Without the
 * tie-break, SQLite's order for tied rows is unspecified — falling back
 * to insertion order in practice, but not guaranteed — which would make
 * "newest first" flip unpredictably for posts written moments apart in
 * fast-running tests or a busy editor session. `id` is monotonically
 * increasing (AUTOINCREMENT), so ties always resolve to the most
 * recently created row.
 */
export async function listPosts(db, { publishedOnly }) {
  const sql = publishedOnly
    ? "SELECT * FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC, id DESC"
    : 'SELECT * FROM blog_posts ORDER BY created_at DESC, id DESC';

  const { results } = await db.prepare(sql).all();
  return results;
}

/**
 * A single post by slug, or `null` if it doesn't exist — or, when
 * `publishedOnly: true`, if it exists but isn't published. Draft
 * invisibility is enforced here as a strict status check, not a
 * truthiness shortcut: only `status === 'published'` counts.
 */
export async function getPost(db, slug, { publishedOnly }) {
  const row = await db.prepare('SELECT * FROM blog_posts WHERE slug = ?')
    .bind(slug).first();

  if (row === null) return null;
  if (publishedOnly && row.status !== 'published') return null;

  return row;
}

// ---------------------------------------------------------------------------
// savePost — create or update, always leaves the post a draft
// ---------------------------------------------------------------------------

function assertValidPost(post) {
  if (typeof post?.title !== 'string' || post.title.trim() === '') {
    throw new BlogError('A post requires a non-empty title.', 400);
  }
  if (typeof post?.bodyMarkdown !== 'string' || post.bodyMarkdown.trim() === '') {
    throw new BlogError('A post requires non-empty body_markdown.', 400);
  }
}

/**
 * Creates a new post (draft, with a freshly generated unique slug) or
 * updates an existing one identified by `post.slug`. Never renders
 * `bodyMarkdown` — it is stored exactly as given.
 *
 * A save never regenerates the slug of an existing post, even if the
 * title changed: the slug is a permanent URL, not a derived display
 * value that tracks the title.
 *
 * If `post.slug` is given but does not match any existing row, this
 * throws rather than silently creating a new row under that slug — an
 * update request naming a slug that doesn't exist is malformed input,
 * not an instruction to create fresh content under someone else's
 * intended permanent URL.
 */
export async function savePost(db, post, editorEmail) {
  assertValidPost(post);

  const heroMediaKey = post.heroMediaKey ?? null;
  const excerpt = post.excerpt ?? null;

  if (post.slug) {
    const existing = await db.prepare('SELECT id FROM blog_posts WHERE slug = ?')
      .bind(post.slug).first();
    if (existing === null) {
      throw new BlogError(`No post found with slug "${post.slug}" to update.`, 404);
    }

    return db.prepare(
      `UPDATE blog_posts
       SET title = ?, excerpt = ?, body_markdown = ?, hero_media_key = ?,
           updated_at = unixepoch(), author_email = ?
       WHERE slug = ?
       RETURNING *`,
    ).bind(post.title, excerpt, post.bodyMarkdown, heroMediaKey, editorEmail, post.slug).first();
  }

  const slug = await generateUniqueSlug(db, post.title, null);

  return db.prepare(
    `INSERT INTO blog_posts
       (slug, title, excerpt, body_markdown, hero_media_key, status, author_email)
     VALUES (?, ?, ?, ?, ?, 'draft', ?)
     RETURNING *`,
  ).bind(slug, post.title, excerpt, post.bodyMarkdown, heroMediaKey, editorEmail).first();
}

// ---------------------------------------------------------------------------
// publishPost — the private-hero-image gate
// ---------------------------------------------------------------------------

/**
 * Flips a post from draft to published, stamping `published_at`. Needs
 * `env` (not just `db`) because it must check the referenced media row's
 * status directly — a post whose `hero_media_key` points at media that is
 * not `status === 'public'` is refused with `BlogError` (400), and the
 * post is left untouched (still a draft). A missing post is a 404
 * `BlogError`, not a silent no-op.
 *
 * `env.DB` is used for the checks and the update, matching how
 * worker/media/repository.js reads `env.DB` directly rather than a
 * separate `db` argument.
 */
export async function publishPost(env, slug, editorEmail) {
  const post = await env.DB.prepare('SELECT * FROM blog_posts WHERE slug = ?')
    .bind(slug).first();

  if (post === null) {
    throw new BlogError(`No post found with slug "${slug}" to publish.`, 404);
  }

  if (post.hero_media_key !== null) {
    const media = await env.DB.prepare('SELECT status FROM media WHERE key = ?')
      .bind(post.hero_media_key).first();

    // Strict check, not a truthiness shortcut: only a row that exists AND
    // has the literal status 'public' passes. A missing media row or any
    // other status refuses the publish.
    if (media?.status !== 'public') {
      throw new BlogError(
        `Cannot publish "${slug}": hero image "${post.hero_media_key}" is not published.`,
        400,
      );
    }
  }

  return env.DB.prepare(
    `UPDATE blog_posts
     SET status = 'published', published_at = unixepoch(), updated_at = unixepoch()
     WHERE slug = ?
     RETURNING *`,
  ).bind(slug).first();
}

// ---------------------------------------------------------------------------
// deletePost
// ---------------------------------------------------------------------------

/**
 * Deletes a post by slug. A slug that doesn't exist is not an error —
 * deleting something already gone leaves the database in the caller's
 * desired end state either way. `editorEmail` is accepted for interface
 * symmetry with the other write operations (and to leave room for an
 * audit trail later) but blog_posts has no deleted-by column to record it
 * against today.
 */
export async function deletePost(db, slug, editorEmail) { // eslint-disable-line no-unused-vars
  await db.prepare('DELETE FROM blog_posts WHERE slug = ?').bind(slug).run();
}
