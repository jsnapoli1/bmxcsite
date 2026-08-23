# Phase 3: Media & Blog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff upload photos and write blog posts from the admin panel. Uploads land **private** and reach the public site only when someone with permission explicitly publishes them.

**Architecture:** Media files go to R2 under a `private/` prefix; publishing copies the object to `public/` and flips a database row. The blog is a new content type in D1 following the draft → publish pattern Phase 2 established, with public pages served through the same version-keyed KV cache.

**Tech Stack:** Cloudflare Workers, D1, R2, Workers KV, Hono 4.13, React 19 + Vite 7, Vitest 4.1 + `@cloudflare/vitest-plugin`.

**Spec:** `docs/superpowers/specs/2026-08-22-admin-panel-design.md`

## Global Constraints

- **Node 22.** ES modules only.
- Permission areas exactly `blog`, `media`, `merch`, `campinfo`; DB flags exactly `can_blog`, `can_media`, `can_merch`, `can_campinfo`, `is_admin`.
- **Every admin route mounts AFTER `app.use('/api/admin/*', requireAuth)`** in `worker/app.js`. A route registered before it is completely ungated — verified empirically in Phase 1.
- **Strict boolean coercion: only literal `true`.** Truthiness bugs have twice caused real defects in this project.
- Timestamps INTEGER Unix seconds via `unixepoch()`, never TEXT.
- All SQL parameterised with `.bind()`. Never interpolate.
- **A write endpoint must never destroy content on a malformed request.** Phase 2 shipped a bug where an empty PUT body wiped an area and returned 200. Reject unreadable input; never treat it as "delete everything".
- Design direction "Field Guide": serif display, warm paper surfaces, **no shadows**, radii 2-6px, structure from rules and weight. Banned: uppercase headings, gradient text, decorative gradients, hover lifts, pill buttons.
- Voice (CLAUDE.md): plain and direct. Avoid em-dash aphorisms, rule-of-three lists, "X, not Y" antithesis.
- **CI cannot apply D1 migrations** (`CLOUDFLARE_API_TOKEN` lacks D1:Edit). Apply by hand with `npm run migrate:remote`.

## The constraint that shapes this whole phase

From CLAUDE.md:

> The other camp photos are better shots but show **individually identifiable
> minors** — not appropriate at hero scale on a site about kids.

This is a site about children. A media feature that can accidentally publish a
camper's face is worse than no media feature. Therefore:

- Uploads land in `private/` and are **invisible to the public site** until
  explicitly published. There is no "publish on upload" path, no default-public
  setting, and no bulk-publish.
- Publishing is a separate, deliberate action requiring the `media` permission.
- The public R2 prefix is served through the Worker, which checks the database
  row's status on every request — an object present in `public/` but not
  published in the database is still not served.
- Every publish and unpublish writes an audit row.

Prefer refusing an upload to guessing. If a check is ambiguous, deny.

---

## Task 1: Media schema and R2 bucket

**Files:**
- Create: `migrations/0003_media.sql`, `test/worker/media-schema.test.js`
- Modify: `wrangler.jsonc`

**Interfaces:**
- Produces table `media` with columns: `id` (INTEGER PK), `key` (TEXT UNIQUE — the R2 object key without prefix), `filename`, `content_type`, `size_bytes` (INTEGER), `width`, `height` (INTEGER, nullable), `alt_text` (TEXT), `caption` (TEXT), `status` (TEXT, `'private'` | `'public'`, default `'private'`), `uploaded_at`, `uploaded_by`, `published_at` (INTEGER nullable), `published_by` (TEXT nullable).
- R2 binding `MEDIA` in `wrangler.jsonc`.

- [ ] **Step 1: Create the R2 bucket**

```bash
CLOUDFLARE_ACCOUNT_ID=9569781c361a80bd0b96dedbac0aca6d \
  npx wrangler r2 bucket create bmxc-media
```

Add to `wrangler.jsonc`:

```jsonc
"r2_buckets": [
  { "binding": "MEDIA", "bucket_name": "bmxc-media" }
]
```

- [ ] **Step 2: Write the failing test**

`test/worker/media-schema.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';

describe('media schema', () => {
  it('defaults a new row to private', async () => {
    await env.DB.prepare(
      `INSERT INTO media (key, filename, content_type, size_bytes, uploaded_by)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind('abc123.jpg', 'group.jpg', 'image/jpeg', 1024, 'ken@example.com').run();

    const row = await env.DB.prepare('SELECT * FROM media WHERE key = ?')
      .bind('abc123.jpg').first();

    expect(row.status).toBe('private');
    expect(row.published_at).toBeNull();
    expect(typeof row.uploaded_at).toBe('number');
  });

  it('rejects a duplicate key', async () => {
    await env.DB.prepare(
      'INSERT INTO media (key, filename, content_type, size_bytes, uploaded_by) VALUES (?,?,?,?,?)',
    ).bind('dup.jpg', 'a.jpg', 'image/jpeg', 1, 'a@b.com').run();

    await expect(
      env.DB.prepare(
        'INSERT INTO media (key, filename, content_type, size_bytes, uploaded_by) VALUES (?,?,?,?,?)',
      ).bind('dup.jpg', 'b.jpg', 'image/jpeg', 1, 'a@b.com').run(),
    ).rejects.toThrow();
  });

  it('records who published and when', async () => {
    await env.DB.prepare(
      'INSERT INTO media (key, filename, content_type, size_bytes, uploaded_by) VALUES (?,?,?,?,?)',
    ).bind('pub.jpg', 'p.jpg', 'image/jpeg', 1, 'ken@example.com').run();

    await env.DB.prepare(
      `UPDATE media SET status = 'public', published_at = unixepoch(),
       published_by = ? WHERE key = ?`,
    ).bind('sarah@example.com', 'pub.jpg').run();

    const row = await env.DB.prepare('SELECT * FROM media WHERE key = ?')
      .bind('pub.jpg').first();
    expect(row.status).toBe('public');
    expect(row.published_by).toBe('sarah@example.com');
    expect(typeof row.published_at).toBe('number');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run test/worker/media-schema.test.js`
Expected: FAIL — `no such table: media`.

- [ ] **Step 4: Write `migrations/0003_media.sql`**

```sql
-- Uploaded media. Rows start private and become public only through an
-- explicit publish by someone holding the `media` permission.
--
-- This site is about children, and some camp photos show individually
-- identifiable minors. A default-private row with no publish-on-upload path
-- is the mechanism that makes an accidental exposure require a deliberate,
-- attributable action.
CREATE TABLE media (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  key          TEXT NOT NULL UNIQUE,
  filename     TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL,
  width        INTEGER,
  height       INTEGER,
  alt_text     TEXT,
  caption      TEXT,
  status       TEXT NOT NULL DEFAULT 'private',
  uploaded_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  uploaded_by  TEXT NOT NULL,
  published_at INTEGER,
  published_by TEXT
);

CREATE INDEX idx_media_status ON media (status, uploaded_at DESC);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run test/worker/media-schema.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 6: Apply locally and commit**

```bash
npm run migrate:local
git add migrations/0003_media.sql wrangler.jsonc test/worker/media-schema.test.js
git commit -m "feat: add media schema, private by default"
```

---

## Task 2: Media repository and R2 operations

**Files:**
- Create: `worker/media/repository.js`, `test/worker/media-repository.test.js`

**Interfaces:**
- `MAX_UPLOAD_BYTES` — `10 * 1024 * 1024`
- `ALLOWED_TYPES` — frozen `['image/jpeg', 'image/png', 'image/webp']`
- `UploadError` — Error subclass with a `.status` (400 or 413)
- `storeUpload(env, { bytes, filename, contentType, uploaderEmail })` → `Promise<row>` — validates, writes to `private/<key>`, inserts the row
- `listMedia(db, { status })` → `Promise<row[]>`
- `publishMedia(env, key, editorEmail)` → `Promise<row>` — copies `private/` → `public/`, flips status
- `unpublishMedia(env, key, editorEmail)` → `Promise<row>` — deletes the `public/` object, flips status back
- `getPublicObject(env, key)` → `Promise<R2Object|null>` — returns null unless the DB row says `public`

- [ ] **Step 1: Write the failing test**

Cover, with real assertions:

```js
it('rejects a file over the size limit with 413')
it('rejects a disallowed content type with 400')
it('rejects a content type that disagrees with the magic bytes')
it('stores under the private prefix and never the public one')
it('a stored upload is not retrievable via getPublicObject')
it('publishMedia copies to public and flips status')
it('after publish, getPublicObject returns the object')
it('unpublishMedia removes the public object and flips status back')
it('after unpublish, getPublicObject returns null again')
it('getPublicObject returns null when the R2 object exists but the row says private')
```

That last one is the important one: it proves the database is the authority,
so an object left behind in `public/` by a partial failure is still not served.

- [ ] **Step 2: Run to verify it fails**

- [ ] **Step 3: Implement `worker/media/repository.js`**

Requirements:
- The R2 key is generated, never taken from the filename. Use
  `crypto.randomUUID()` plus an extension derived from the validated content
  type. A user-supplied filename must never become a path.
- **Verify magic bytes**, do not trust the declared `Content-Type`: JPEG
  `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF....WEBP`. A mismatch is a 400.
- `storeUpload` writes R2 first, then inserts the row. If the insert fails,
  delete the orphaned object before rethrowing.
- `getPublicObject` reads the DB row first and returns `null` unless
  `status === 'public'`. Never serve based on the object's existence alone.

- [ ] **Step 4: Run to verify it passes**

- [ ] **Step 5: Commit**

---

## Task 3: Media API routes

**Files:**
- Create: `worker/routes/media.js`, `test/worker/media-api.test.js`
- Modify: `worker/app.js`

**Interfaces:**
- `POST /api/admin/media` — multipart upload, requires `media`
- `GET /api/admin/media` — list all, requires `media`
- `POST /api/admin/media/:key/publish` — requires `media`, writes audit
- `POST /api/admin/media/:key/unpublish` — requires `media`, writes audit
- `DELETE /api/admin/media/:key` — requires `media`, writes audit
- `GET /media/:key` — **public**, serves only published objects

- [ ] **Step 1: Write auth-denial tests FIRST**

```js
it('denies upload to a user without the media permission')
it('denies publish to a user without the media permission')
it('denies an unregistered but verified email')
it('the public route does not serve a private object')
it('the public route 404s an unknown key')
```

- [ ] **Step 2-4: Implement, mounting AFTER `requireAuth`**

`GET /media/:key` mounts on a separate public prefix, like `/api/content`.

Cache headers: published media is immutable (the key is a UUID), so
`Cache-Control: public, max-age=31536000, immutable`. A private object must
never be cached — if a request somehow reaches it, respond
`Cache-Control: no-store`.

- [ ] **Step 5: Verify with wrangler dev + curl**, confirming a private object
  404s publicly and a published one serves.

---

## Task 4: Blog schema and repository

**Files:**
- Create: `migrations/0004_blog.sql`, `worker/content/blog.js`, tests

**Interfaces:**
- Table `blog_posts`: `id`, `slug` (TEXT UNIQUE), `title`, `excerpt`, `body_markdown`, `hero_media_key` (nullable, references a media key), `status` (`draft`|`published`), `published_at`, `created_at`, `updated_at`, `author_email`.
- `listPosts(db, { publishedOnly })`, `getPost(db, slug, { publishedOnly })`,
  `savePost(db, post, editorEmail)`, `publishPost(db, slug, editorEmail)`,
  `deletePost(db, slug, editorEmail)`.

Requirements:
- Slugs are generated from the title but **must be unique**; on collision
  append `-2`, `-3`. A slug is a permanent URL — never silently overwrite one.
- Body is stored as Markdown text. It is **not** rendered to HTML on save.
- A post's `hero_media_key` may only reference **published** media. Referencing
  a private image would leak it through the blog. Validate on publish.

- [ ] Write failing tests covering slug collision, draft invisibility, and the
      private-hero-image rejection. Then implement.

---

## Task 5: Markdown rendering, safely

**Files:**
- Create: `src/lib/markdown.js`, `test/lib/markdown.test.js`

This is the highest-risk task in the phase. Blog bodies are authored by staff
and rendered into the public site. Markdown renderers are a classic XSS vector.

Requirements:
- Use an established library. Do NOT hand-roll a Markdown parser.
- **Disable raw HTML entirely.** Staff write Markdown, not HTML. This removes
  the entire class of injection at the source rather than trying to sanitise
  it afterwards.
- No `dangerouslySetInnerHTML` on unsanitised output. If the chosen renderer
  emits an HTML string, sanitise it before rendering; prefer a renderer that
  produces React elements directly.
- Links: force `rel="noopener noreferrer"` and only allow `http`, `https`, and
  `mailto` schemes. A `javascript:` URL must not survive.

- [ ] **Write these tests FIRST and see them fail:**

```js
it('renders a heading, a list, and a link')
it('does not render a raw <script> tag')
it('does not render raw HTML at all, even benign HTML')
it('strips a javascript: URL from a link')
it('strips an onerror attribute from an image')
it('leaves an em-dash and a curly quote intact')  // the camp's own voice
```

The last one matters: CLAUDE.md is explicit that the camp's punctuation is
theirs and must not be normalised.

---

## Task 6: Blog API and public pages

**Files:**
- Create: `worker/routes/blog.js`, `src/pages/Blog.jsx`, `src/pages/BlogPost.jsx`,
  `src/pages/blog.css`
- Modify: `worker/app.js`, `src/App.jsx`

- `GET /api/content/blog` — public, published only, cached
- `GET /api/content/blog/:slug` — public, published only, cached
- `/api/admin/blog/*` — requires `blog`

Public routes `/blog` and `/blog/:slug` render in the Field Guide direction:
ruled entries, serif display, no cards, no shadows. A blog index is a list of
dated entries, not a grid of tiles.

- [ ] Verify in a browser at 320, 768, and 1440 widths. Confirm reveal
      animations run and nothing sits at `opacity: 0` — CLAUDE.md warns that
      this project's bugs are invisible to a passing build.

---

## Task 7: Admin editors for media and blog

**Files:**
- Create: `src/admin/pages/Media.jsx`, `src/admin/pages/Blog.jsx`
- Modify: `src/admin/AdminApp.jsx`

Requirements:
- The media library shows **private and public in visually distinct groups**,
  with the private group first and clearly labelled. A staffer must never have
  to guess whether an image is live.
- Publishing a photo requires a confirmation step naming what will happen:
  "This makes the photo visible to anyone on the internet." Given the subject
  matter, an accidental single click should not expose a child's photograph.
- Alt text is **required** before a photo can be published. It is an
  accessibility requirement and it forces a moment's attention on the image.
- Reuse the per-key in-flight guard pattern from `src/admin/pages/Users.jsx` —
  a failed request must never leave a control permanently disabled.
- Blog editor: title, slug (auto-filled from title, editable), excerpt, body,
  optional hero image chosen from **published** media only.

- [ ] Verify in a browser: upload a photo, confirm it does NOT appear on the
      public site, publish it, confirm it does, then unpublish and confirm it
      stops being served.

---

## Definition of done

- [ ] `npm test` passes, order-independent under `--sequence.shuffle`
- [ ] An uploaded photo is not reachable publicly until explicitly published
- [ ] A published photo stops being served immediately on unpublish
- [ ] An R2 object present in `public/` but not published in the DB is still not served
- [ ] A file whose magic bytes disagree with its declared type is rejected
- [ ] A blog post cannot reference a private image
- [ ] `<script>`, raw HTML, `javascript:` URLs, and event handlers cannot reach a rendered post
- [ ] Alt text is required before publishing a photo
- [ ] Publishing a photo requires a confirmation naming the consequence
- [ ] Every publish/unpublish/delete appears in `audit_log`
- [ ] Blog pages verified in a browser at 320, 768, 1440
- [ ] `migrations/0003_media.sql` and `0004_blog.sql` applied to remote by hand
