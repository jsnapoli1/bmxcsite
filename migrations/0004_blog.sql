-- Blog posts. A new content type: unlike staff/faq/merch/campinfo (which
-- are singleton areas replaced wholesale on every save), each post is its
-- own row with its own permanent public URL, so it needs a stable unique
-- slug rather than a delete-then-reinsert area shape.
--
-- `body_markdown` stores the author's Markdown text verbatim, never
-- pre-rendered HTML. Rendering happens at read time (Task 5) — storing
-- rendered HTML here would mean a future rendering bug is baked
-- permanently into the database rather than fixable by changing the
-- renderer.
--
-- `hero_media_key` is a soft reference to `media.key` (no FK — media rows
-- are looked up through the media repository, which is the sole authority
-- on public/private status). A post may only be published if the media row
-- it references is `status = 'public'`; that check happens in
-- worker/content/blog.js at publish time, not here.
CREATE TABLE blog_posts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  excerpt         TEXT,
  body_markdown   TEXT NOT NULL,
  hero_media_key  TEXT,
  status          TEXT NOT NULL DEFAULT 'draft',
  published_at    INTEGER,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  author_email    TEXT NOT NULL
);

-- Serves the public index page: newest published post first, without a
-- table scan over drafts. `id DESC` matches the tie-break the repository's
-- ORDER BY uses when two posts share the same published_at second.
CREATE INDEX idx_blog_posts_status_published_at
  ON blog_posts (status, published_at DESC, id DESC);
