# Media library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the media library albums, multi-file upload and video, without weakening any rule that keeps a child's photograph private.

**Architecture:** A new `albums` table and an `album_id` column on `media`. Video is added to the existing magic-byte allowlist rather than beside it, so one validator still decides what may be stored. The admin page gains a queue-based uploader and per-album grouping; `Media.jsx` is split because it is already 400+ lines and this would double it.

**Tech Stack:** Cloudflare D1, R2, Hono, React 19, Vitest with the Workers pool.

**Spec:** `docs/superpowers/specs/2026-09-03-admin-panel-design.md` (section 2)

## Global Constraints

From the spec, CLAUDE.md, and the invariants stated at the top of
`worker/media/repository.js`. Every task inherits these.

- **The D1 row is the sole authority on what is public.** `getPublicObject`
  reads the row first and serves only `status === 'public'`. Never serve on
  the basis that an object exists in the bucket.
- **There is no publish-on-upload path.** `storeUpload` always writes to
  `private/` and always inserts `status = 'private'`. Nothing added here may
  take a parameter that changes that.
- **Declared Content-Type is never trusted.** Every accepted type must be
  confirmed by magic bytes, and the stored extension comes from the
  validated type — never from the filename.
- **Alt text gates publishing**, enforced in `publishMedia`, not only in the
  UI. This applies to video too.
- **When a check is ambiguous, deny.**
- **Field Guide direction**: serif display, warm paper, no shadows, radii
  2-6px. Banned: uppercase headings, gradient text, decorative gradients,
  hover lifts, pill buttons.
- **Verify in a browser** before claiming done (Task 8).

---

### Task 1: Albums schema

**Files:**
- Create: `migrations/0006_albums.sql`, `test/worker/album-schema.test.js`

**Interfaces:**
- Produces: table `albums (id, slug, title, description, created_at, created_by)` and column `media.album_id` (nullable, `REFERENCES albums(id) ON DELETE SET NULL`).

- [ ] **Step 1: Write the failing test**

Create `test/worker/album-schema.test.js`:

```js
import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

describe('albums schema', () => {
  it('stores an album and returns it by slug', async () => {
    await env.DB.prepare(
      "INSERT INTO albums (slug, title, created_by) VALUES ('2026-session-1', 'Session 1', 'a@b.c')",
    ).run();
    const row = await env.DB.prepare(
      "SELECT * FROM albums WHERE slug = '2026-session-1'",
    ).first();
    expect(row.title).toBe('Session 1');
    expect(row.created_at).toBeGreaterThan(0);
  });

  it('refuses two albums with the same slug', async () => {
    await env.DB.prepare(
      "INSERT INTO albums (slug, title, created_by) VALUES ('dup', 'One', 'a@b.c')",
    ).run();
    await expect(
      env.DB.prepare(
        "INSERT INTO albums (slug, title, created_by) VALUES ('dup', 'Two', 'a@b.c')",
      ).run(),
    ).rejects.toThrow();
  });

  it('lets media belong to no album', async () => {
    await env.DB.prepare(
      `INSERT INTO media (key, filename, content_type, size_bytes, uploaded_by)
       VALUES ('k-none.jpg', 'p.jpg', 'image/jpeg', 10, 'a@b.c')`,
    ).run();
    const row = await env.DB.prepare("SELECT album_id FROM media WHERE key = 'k-none.jpg'").first();
    expect(row.album_id).toBeNull();
  });

  it('detaches media instead of deleting it when its album goes', async () => {
    // A director deleting an album must not delete the photographs in it.
    // Losing an organisational grouping is recoverable; losing the only
    // copy of a camp photo is not.
    const album = await env.DB.prepare(
      "INSERT INTO albums (slug, title, created_by) VALUES ('temp', 'Temp', 'a@b.c') RETURNING id",
    ).first();
    await env.DB.prepare(
      `INSERT INTO media (key, filename, content_type, size_bytes, uploaded_by, album_id)
       VALUES ('k-att.jpg', 'p.jpg', 'image/jpeg', 10, 'a@b.c', ?)`,
    ).bind(album.id).run();

    await env.DB.prepare('DELETE FROM albums WHERE id = ?').bind(album.id).run();

    const row = await env.DB.prepare("SELECT album_id FROM media WHERE key = 'k-att.jpg'").first();
    expect(row).not.toBeNull();
    expect(row.album_id).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run test/worker/album-schema.test.js
```

Expected: FAIL — `no such table: albums`.

- [ ] **Step 3: Write the migration**

Create `migrations/0006_albums.sql`:

```sql
-- Albums group media into sessions or events.
--
-- An album is an organisational label, never a permission boundary: what
-- is public is decided by media.status alone (worker/media/repository.js).
-- Putting a photo in an album must not be able to publish it, and taking
-- one out must not be able to hide it.
CREATE TABLE albums (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  description TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  created_by  TEXT NOT NULL
);

-- ON DELETE SET NULL, not CASCADE. Deleting an album is an organisational
-- act; it must never delete photographs. The media row survives with no
-- album, which is the same state every row starts in.
ALTER TABLE media ADD COLUMN album_id INTEGER
  REFERENCES albums(id) ON DELETE SET NULL;

CREATE INDEX idx_media_album ON media (album_id, uploaded_at DESC);
```

- [ ] **Step 4: Run it and watch it pass**

```bash
npx vitest run test/worker/album-schema.test.js
```

Expected: PASS, 4 tests.

If the detach test fails, check that foreign keys are enforced — D1
enables them by default, but `ALTER TABLE ... ADD COLUMN` with a
`REFERENCES` clause only applies to rows written after it. If enforcement
turns out to be off in this runtime, drop the FK clause and do the detach
in `deleteAlbum` explicitly (`UPDATE media SET album_id = NULL WHERE
album_id = ?` before the `DELETE`), keeping the same test.

- [ ] **Step 5: Commit**

```bash
git add migrations/0006_albums.sql test/worker/album-schema.test.js
git commit -m "feat: add albums, detaching media rather than deleting it"
```

---

### Task 2: Album repository

**Files:**
- Create: `worker/media/albums.js`, `test/worker/album-repository.test.js`

**Interfaces:**
- Produces:
  - `listAlbums(db)` → rows plus `item_count`, newest first
  - `createAlbum(db, { title, description, creatorEmail })` → row; derives a unique slug from the title
  - `updateAlbum(db, id, { title, description })` → row or `null`
  - `deleteAlbum(db, id)` → `boolean`
  - `setMediaAlbum(db, key, albumId)` → row or `null`
  - `AlbumError` with a `status` field, thrown for a blank title

- [ ] **Step 1: Write the failing test**

Create `test/worker/album-repository.test.js`:

```js
import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import {
  listAlbums, createAlbum, updateAlbum, deleteAlbum, setMediaAlbum, AlbumError,
} from '../../worker/media/albums.js';

async function seedMedia(key, albumId = null) {
  await env.DB.prepare(
    `INSERT INTO media (key, filename, content_type, size_bytes, uploaded_by, album_id)
     VALUES (?, 'p.jpg', 'image/jpeg', 10, 'a@b.c', ?)`,
  ).bind(key, albumId).run();
}

describe('createAlbum', () => {
  it('derives a slug from the title', async () => {
    const row = await createAlbum(env.DB, { title: 'Session One 2026', creatorEmail: 'a@b.c' });
    expect(row.slug).toBe('session-one-2026');
  });

  it('makes a second album with the same title unique', async () => {
    await createAlbum(env.DB, { title: 'Camp Week', creatorEmail: 'a@b.c' });
    const second = await createAlbum(env.DB, { title: 'Camp Week', creatorEmail: 'a@b.c' });
    expect(second.slug).not.toBe('camp-week');
    expect(second.slug.startsWith('camp-week')).toBe(true);
  });

  it('refuses a blank title', async () => {
    await expect(
      createAlbum(env.DB, { title: '   ', creatorEmail: 'a@b.c' }),
    ).rejects.toThrow(AlbumError);
  });

  it('refuses a title that would slugify to nothing', async () => {
    // '///' has no slug characters. Without this the album would get an
    // empty slug, and the second such album would collide on UNIQUE.
    await expect(
      createAlbum(env.DB, { title: '///', creatorEmail: 'a@b.c' }),
    ).rejects.toThrow(AlbumError);
  });
});

describe('listAlbums', () => {
  it('counts the media in each album', async () => {
    const album = await createAlbum(env.DB, { title: 'Counted', creatorEmail: 'a@b.c' });
    await seedMedia('c1.jpg', album.id);
    await seedMedia('c2.jpg', album.id);

    const rows = await listAlbums(env.DB);
    const found = rows.find((r) => r.id === album.id);
    expect(found.item_count).toBe(2);
  });

  it('reports zero for an empty album rather than omitting it', async () => {
    const album = await createAlbum(env.DB, { title: 'Empty One', creatorEmail: 'a@b.c' });
    const rows = await listAlbums(env.DB);
    const found = rows.find((r) => r.id === album.id);
    expect(found).toBeDefined();
    expect(found.item_count).toBe(0);
  });
});

describe('setMediaAlbum', () => {
  it('moves a photo into an album', async () => {
    const album = await createAlbum(env.DB, { title: 'Target', creatorEmail: 'a@b.c' });
    await seedMedia('m1.jpg');
    const row = await setMediaAlbum(env.DB, 'm1.jpg', album.id);
    expect(row.album_id).toBe(album.id);
  });

  it('takes a photo out of every album with null', async () => {
    const album = await createAlbum(env.DB, { title: 'Leaving', creatorEmail: 'a@b.c' });
    await seedMedia('m2.jpg', album.id);
    const row = await setMediaAlbum(env.DB, 'm2.jpg', null);
    expect(row.album_id).toBeNull();
  });

  it('cannot change what is public', async () => {
    // Albums are organisational. Moving a photo between them must not be a
    // second path to publishing, which is publishMedia's job alone.
    const album = await createAlbum(env.DB, { title: 'Not A Gate', creatorEmail: 'a@b.c' });
    await seedMedia('m3.jpg');
    const row = await setMediaAlbum(env.DB, 'm3.jpg', album.id);
    expect(row.status).toBe('private');
  });

  it('returns null for a key that does not exist', async () => {
    expect(await setMediaAlbum(env.DB, 'nope.jpg', null)).toBeNull();
  });
});

describe('deleteAlbum', () => {
  it('keeps the media and clears its album', async () => {
    const album = await createAlbum(env.DB, { title: 'Doomed', creatorEmail: 'a@b.c' });
    await seedMedia('d1.jpg', album.id);

    expect(await deleteAlbum(env.DB, album.id)).toBe(true);

    const media = await env.DB.prepare("SELECT * FROM media WHERE key = 'd1.jpg'").first();
    expect(media).not.toBeNull();
    expect(media.album_id).toBeNull();
  });

  it('reports false for an album that is not there', async () => {
    expect(await deleteAlbum(env.DB, 99999)).toBe(false);
  });
});

describe('updateAlbum', () => {
  it('changes the title without changing the slug', async () => {
    // The slug is the stable handle. Renaming an album for clarity should
    // not silently repoint anything that referenced the old slug.
    const album = await createAlbum(env.DB, { title: 'Before', creatorEmail: 'a@b.c' });
    const row = await updateAlbum(env.DB, album.id, { title: 'After' });
    expect(row.title).toBe('After');
    expect(row.slug).toBe('before');
  });

  it('returns null for an album that is not there', async () => {
    expect(await updateAlbum(env.DB, 99999, { title: 'X' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run test/worker/album-repository.test.js
```

Expected: FAIL — cannot resolve `worker/media/albums.js`.

- [ ] **Step 3: Write the module**

Create `worker/media/albums.js`:

```js
/**
 * Albums: an organisational grouping over media.
 *
 * Deliberately separate from repository.js, which owns the private/public
 * decision. Nothing here may change `status` — an album is a label, not a
 * permission boundary, and keeping the two modules apart is what stops a
 * grouping change from becoming a second way to publish a photograph.
 */

export class AlbumError extends Error {
  /** @param {string} message @param {400} status */
  constructor(message, status) {
    super(message);
    this.name = 'AlbumError';
    this.status = status;
  }
}

/**
 * A URL-safe handle derived from the title. Returns '' when the title
 * holds no slug characters at all, which the caller must reject rather
 * than store — two such albums would collide on the UNIQUE index.
 */
function slugify(title) {
  return String(title)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function listAlbums(db) {
  // LEFT JOIN, not an inner join: an album with nothing in it yet must
  // still appear, otherwise a director creates one and it vanishes.
  const { results } = await db.prepare(
    `SELECT albums.*, COUNT(media.id) AS item_count
     FROM albums
     LEFT JOIN media ON media.album_id = albums.id
     GROUP BY albums.id
     ORDER BY albums.created_at DESC`,
  ).all();
  return results;
}

export async function createAlbum(db, { title, description, creatorEmail }) {
  const trimmed = String(title ?? '').trim();
  if (trimmed === '') {
    throw new AlbumError('An album needs a title.', 400);
  }

  const base = slugify(trimmed);
  if (base === '') {
    throw new AlbumError('That title has no letters or numbers to make a link from.', 400);
  }

  // Append a short random suffix when the slug is taken rather than
  // counting up: a count would need a read-then-write that two concurrent
  // creates could both pass.
  const taken = await db.prepare('SELECT 1 FROM albums WHERE slug = ?').bind(base).first();
  const slug = taken ? `${base}-${crypto.randomUUID().slice(0, 6)}` : base;

  return db.prepare(
    `INSERT INTO albums (slug, title, description, created_by)
     VALUES (?, ?, ?, ?)
     RETURNING *`,
  ).bind(slug, trimmed, description ?? null, creatorEmail).first();
}

/**
 * Updates the title and/or description. The slug is deliberately not
 * derived again — it is the stable handle, and renaming an album for
 * clarity should not repoint anything that referenced the old one.
 */
export async function updateAlbum(db, id, { title, description }) {
  const trimmed = title === undefined ? undefined : String(title).trim();
  if (trimmed === '') {
    throw new AlbumError('An album needs a title.', 400);
  }

  const row = await db.prepare(
    `UPDATE albums
     SET title = COALESCE(?, title), description = COALESCE(?, description)
     WHERE id = ?
     RETURNING *`,
  ).bind(trimmed ?? null, description ?? null, id).first();

  return row ?? null;
}

/**
 * Deletes the album. Media in it is detached, never deleted — losing a
 * grouping is recoverable, losing the only copy of a camp photograph is
 * not. The detach is explicit here as well as declared in the schema, so
 * the behaviour does not depend on foreign keys being enforced.
 */
export async function deleteAlbum(db, id) {
  const existing = await db.prepare('SELECT 1 FROM albums WHERE id = ?').bind(id).first();
  if (existing === null) return false;

  await db.prepare('UPDATE media SET album_id = NULL WHERE album_id = ?').bind(id).run();
  await db.prepare('DELETE FROM albums WHERE id = ?').bind(id).run();
  return true;
}

/**
 * Moves one media row into an album, or out of every album with a null
 * `albumId`. Touches `album_id` and nothing else — in particular never
 * `status`.
 */
export async function setMediaAlbum(db, key, albumId) {
  const row = await db.prepare(
    'UPDATE media SET album_id = ? WHERE key = ? RETURNING *',
  ).bind(albumId, key).first();
  return row ?? null;
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
npx vitest run test/worker/album-repository.test.js
```

Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add worker/media/albums.js test/worker/album-repository.test.js
git commit -m "feat: add the album repository"
```

---

### Task 3: Video uploads

Extends the existing validator. Video goes through the same magic-byte
check, the same private-by-default insert, and the same alt-text publish
gate as photographs.

**Files:**
- Modify: `worker/media/repository.js`
- Create: `test/worker/media-video.test.js`

**Interfaces:**
- Consumes: `storeUpload`, `ALLOWED_TYPES`, `MAX_UPLOAD_BYTES` as they are.
- Produces: `ALLOWED_TYPES` also containing `video/mp4`; `MAX_UPLOAD_BYTES_VIDEO` (200MB); `isVideo(contentType)` → boolean.

- [ ] **Step 1: Write the failing test**

Create `test/worker/media-video.test.js`:

```js
import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { storeUpload, isVideo, MAX_UPLOAD_BYTES_VIDEO } from '../../worker/media/repository.js';

/**
 * A minimal but genuine MP4 header: a 'ftyp' box with the 'isom' brand at
 * offset 4, which is what the sniffer keys on.
 */
function mp4Bytes(extra = 0) {
  const head = [
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70, // 'ftyp'
    0x69, 0x73, 0x6f, 0x6d, // 'isom'
    0x00, 0x00, 0x02, 0x00,
  ];
  return new Uint8Array([...head, ...new Array(extra).fill(0)]);
}

const upload = (bytes, contentType, filename = 'clip.mp4') => storeUpload(env, {
  bytes, filename, contentType, uploaderEmail: 'a@b.c',
});

describe('video uploads', () => {
  it('accepts a genuine mp4', async () => {
    const row = await upload(mp4Bytes(), 'video/mp4');
    expect(row.content_type).toBe('video/mp4');
    expect(row.key.endsWith('.mp4')).toBe(true);
  });

  it('stores a video private, exactly like a photo', async () => {
    const row = await upload(mp4Bytes(), 'video/mp4');
    expect(row.status).toBe('private');
  });

  it('refuses a file that claims to be mp4 but is not', async () => {
    const notVideo = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00]);
    await expect(upload(notVideo, 'video/mp4')).rejects.toThrow(/does not match/);
  });

  it('refuses an mp4 declared as an image', async () => {
    await expect(upload(mp4Bytes(), 'image/jpeg')).rejects.toThrow(/does not match/);
  });

  it('refuses a video over the video limit', async () => {
    // Constructed just past the ceiling. Uses the video limit, not the
    // image one — a 10MB cap would make video unusable.
    const tooBig = mp4Bytes(MAX_UPLOAD_BYTES_VIDEO);
    await expect(upload(tooBig, 'video/mp4')).rejects.toThrow(/over the/);
  });

  it('still holds images to the smaller image limit', async () => {
    // The larger video ceiling must not become the ceiling for everything.
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, ...new Array(11 * 1024 * 1024).fill(0)]);
    await expect(upload(jpeg, 'image/jpeg', 'big.jpg')).rejects.toThrow(/over the/);
  });
});

describe('isVideo', () => {
  it('recognises mp4', () => expect(isVideo('video/mp4')).toBe(true));
  it('does not claim an image is video', () => expect(isVideo('image/jpeg')).toBe(false));
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run test/worker/media-video.test.js
```

Expected: FAIL — `isVideo` is not exported.

- [ ] **Step 3: Extend the validator**

In `worker/media/repository.js`:

Replace the `MAX_UPLOAD_BYTES` / `ALLOWED_TYPES` / `EXTENSIONS_BY_TYPE`
block with:

```js
/** Largest image this repository will accept, in bytes. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Largest video, in bytes. Separate and larger because a 10MB ceiling
 * makes video unusable, and because the two limits should be able to move
 * independently — a change to what a photograph may weigh should not
 * silently change what a video may weigh.
 */
export const MAX_UPLOAD_BYTES_VIDEO = 200 * 1024 * 1024;

/** Content types this repository will accept, matched against magic bytes. */
export const ALLOWED_TYPES = Object.freeze([
  'image/jpeg', 'image/png', 'image/webp', 'video/mp4',
]);

const EXTENSIONS_BY_TYPE = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
});

/** Whether a validated content type is video rather than a still image. */
export function isVideo(contentType) {
  return String(contentType).startsWith('video/');
}
```

Add the MP4 signature check to `sniffContentType`, after the WEBP branch
and before `return null`:

```js
  // MP4: a 'ftyp' box at offset 4. The four bytes before it are the box
  // length, which varies, so the brand is what identifies the container.
  if (startsWith(bytes, FTYP_SIGNATURE, 4)) return 'video/mp4';
```

And declare the signature beside the others:

```js
const FTYP_SIGNATURE = [0x66, 0x74, 0x79, 0x70]; // 'ftyp'
```

In `assertValidUpload`, replace the size check with one that picks the
limit by declared type:

```js
function assertValidUpload(bytes, contentType) {
  // Strict membership first: the limit is chosen from the declared type,
  // so an unknown type must not reach the size comparison at all.
  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new UploadError(`Content type "${contentType}" is not allowed.`, 400);
  }

  const limit = isVideo(contentType) ? MAX_UPLOAD_BYTES_VIDEO : MAX_UPLOAD_BYTES;
  if (bytes.byteLength > limit) {
    throw new UploadError(
      `File is ${bytes.byteLength} bytes, over the ${limit}-byte limit.`,
      413,
    );
  }

  const actualType = sniffContentType(bytes);
  if (actualType === null) {
    throw new UploadError('File content does not match any allowed type.', 400);
  }
  if (actualType !== contentType) {
    throw new UploadError(
      `Declared content type "${contentType}" does not match file contents (looks like "${actualType}").`,
      400,
    );
  }
}
```

Note the reordering: the allowlist check now runs before the size check,
because the limit is derived from the declared type. An unknown type must
be rejected as unknown, not measured against a limit chosen for it.

- [ ] **Step 4: Run it and watch it pass**

```bash
npx vitest run test/worker/media-video.test.js
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Run the existing media suites**

The size-check reordering touches paths those tests pin.

```bash
npx vitest run test/worker/media-boundaries.test.js test/worker/media-adversarial.test.js test/worker/media-api.test.js test/worker/media-repository.test.js
```

Expected: all pass. If `media-boundaries` fails on the "one byte over the
limit" case, check that the image path still uses `MAX_UPLOAD_BYTES` and
not the video ceiling.

- [ ] **Step 6: Commit**

```bash
git add worker/media/repository.js test/worker/media-video.test.js
git commit -m "feat: accept mp4 uploads through the same magic-byte gate"
```

---

### Task 4: Album routes

**Files:**
- Modify: `worker/routes/media.js`
- Create: `test/worker/album-api.test.js`

**Interfaces:**
- Consumes: `listAlbums`, `createAlbum`, `updateAlbum`, `deleteAlbum`, `setMediaAlbum`, `AlbumError` from `worker/media/albums.js`.
- Produces: `GET /api/admin/media/albums`, `POST /api/admin/media/albums`, `PATCH /api/admin/media/albums/:id`, `DELETE /api/admin/media/albums/:id`, `PUT /api/admin/media/:key/album`.

- [ ] **Step 1: Write the failing test**

Create `test/worker/album-api.test.js`. Follow the request-shaping helper
already used in `test/worker/media-api.test.js` — read that file first and
reuse its auth header helper rather than writing a second one.

```js
import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import { signedHeaders } from './helpers/access.js';

// If test/worker/helpers/access.js does not exist, copy the header-signing
// approach from test/worker/media-api.test.js instead of inventing one.

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM albums").run();
  await env.DB.prepare(
    "INSERT OR REPLACE INTO users (email, name, is_admin, can_media) VALUES ('m@b.c', 'M', 0, 1)",
  ).run();
});

describe('album routes', () => {
  it('creates an album for someone holding media', async () => {
    const res = await SELF.fetch('https://x/api/admin/media/albums', {
      method: 'POST',
      headers: { ...(await signedHeaders('m@b.c')), 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Session 1' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.album.slug).toBe('session-1');
  });

  it('refuses someone without the media permission', async () => {
    await env.DB.prepare(
      "INSERT OR REPLACE INTO users (email, name, is_admin, can_media) VALUES ('no@b.c', 'N', 0, 0)",
    ).run();
    const res = await SELF.fetch('https://x/api/admin/media/albums', {
      method: 'POST',
      headers: { ...(await signedHeaders('no@b.c')), 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Nope' }),
    });
    expect(res.status).toBe(403);
  });

  it('refuses a blank title with 400, not 500', async () => {
    const res = await SELF.fetch('https://x/api/admin/media/albums', {
      method: 'POST',
      headers: { ...(await signedHeaders('m@b.c')), 'content-type': 'application/json' },
      body: JSON.stringify({ title: '  ' }),
    });
    expect(res.status).toBe(400);
  });

  it('moving a photo between albums never publishes it', async () => {
    await env.DB.prepare(
      `INSERT INTO media (key, filename, content_type, size_bytes, uploaded_by)
       VALUES ('mv.jpg', 'p.jpg', 'image/jpeg', 10, 'm@b.c')`,
    ).run();
    const created = await SELF.fetch('https://x/api/admin/media/albums', {
      method: 'POST',
      headers: { ...(await signedHeaders('m@b.c')), 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Dest' }),
    });
    const { album } = await created.json();

    const res = await SELF.fetch('https://x/api/admin/media/mv.jpg/album', {
      method: 'PUT',
      headers: { ...(await signedHeaders('m@b.c')), 'content-type': 'application/json' },
      body: JSON.stringify({ albumId: album.id }),
    });
    expect(res.status).toBe(200);
    const { media } = await res.json();
    expect(media.album_id).toBe(album.id);
    expect(media.status).toBe('private');
  });

  it('deleting an album keeps its photographs', async () => {
    const created = await SELF.fetch('https://x/api/admin/media/albums', {
      method: 'POST',
      headers: { ...(await signedHeaders('m@b.c')), 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Doomed' }),
    });
    const { album } = await created.json();
    await env.DB.prepare(
      `INSERT INTO media (key, filename, content_type, size_bytes, uploaded_by, album_id)
       VALUES ('keep.jpg', 'p.jpg', 'image/jpeg', 10, 'm@b.c', ?)`,
    ).bind(album.id).run();

    const res = await SELF.fetch(`https://x/api/admin/media/albums/${album.id}`, {
      method: 'DELETE',
      headers: await signedHeaders('m@b.c'),
    });
    expect(res.status).toBe(200);

    const still = await env.DB.prepare("SELECT * FROM media WHERE key = 'keep.jpg'").first();
    expect(still).not.toBeNull();
    expect(still.album_id).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run test/worker/album-api.test.js
```

Expected: FAIL — 404 on the album routes.

- [ ] **Step 3: Add the routes**

In `worker/routes/media.js`, import the album module beside the existing
repository import:

```js
import {
  listAlbums, createAlbum, updateAlbum, deleteAlbum, setMediaAlbum, AlbumError,
} from '../media/albums.js';
```

Add these routes **above** `media.patch('/:key', ...)`. Order matters:
`/albums` would otherwise be captured by the `/:key` parameter route and
treated as a media key.

```js
// --- Albums --------------------------------------------------------------
// Registered before the /:key routes below: Hono matches in order, and
// '/albums' would otherwise bind as a media key.

media.get('/albums', async (c) => {
  return c.json({ albums: await listAlbums(c.env.DB) });
});

media.post('/albums', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Request body must be valid JSON' }, 400);
  }

  let album;
  try {
    album = await createAlbum(c.env.DB, {
      title: body.title,
      description: typeof body.description === 'string' ? body.description : undefined,
      creatorEmail: c.get('email'),
    });
  } catch (error) {
    if (error instanceof AlbumError) return c.json({ error: error.message }, error.status);
    throw error;
  }

  await audit(c.env.DB, c.get('email'), 'album.create', album.slug);
  return c.json({ album }, 201);
});

media.patch('/albums/:id', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Request body must be valid JSON' }, 400);
  }

  let album;
  try {
    album = await updateAlbum(c.env.DB, Number(c.req.param('id')), {
      title: typeof body.title === 'string' ? body.title : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
    });
  } catch (error) {
    if (error instanceof AlbumError) return c.json({ error: error.message }, error.status);
    throw error;
  }

  if (album === null) return c.json({ error: 'No such album.' }, 404);

  await audit(c.env.DB, c.get('email'), 'album.update', album.slug);
  return c.json({ album });
});

media.delete('/albums/:id', async (c) => {
  const removed = await deleteAlbum(c.env.DB, Number(c.req.param('id')));
  if (!removed) return c.json({ error: 'No such album.' }, 404);

  await audit(c.env.DB, c.get('email'), 'album.delete', c.req.param('id'));
  return c.json({ ok: true });
});

// Moves one item into an album, or out of every album with albumId: null.
// Cannot change `status` — see setMediaAlbum in worker/media/albums.js.
media.put('/:key/album', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Request body must be valid JSON' }, 400);
  }

  const albumId = body.albumId === null || body.albumId === undefined
    ? null
    : Number(body.albumId);

  const row = await setMediaAlbum(c.env.DB, c.req.param('key'), albumId);
  if (row === null) {
    return c.json({ error: `No media row found for key "${c.req.param('key')}".` }, 404);
  }

  await audit(c.env.DB, c.get('email'), 'media.album', c.req.param('key'));
  return c.json({ media: row });
});
```

- [ ] **Step 4: Run it and watch it pass**

```bash
npx vitest run test/worker/album-api.test.js
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add worker/routes/media.js test/worker/album-api.test.js
git commit -m "feat: add album routes behind the media permission"
```

---

### Task 5: Admin API client

**Files:**
- Modify: `src/admin/lib/api.js`

**Interfaces:**
- Produces: `listAlbums()`, `createAlbum({title, description})`, `updateAlbum(id, {title, description})`, `deleteAlbum(id)`, `setMediaAlbum(key, albumId)`.

- [ ] **Step 1: Add the calls**

Append to `src/admin/lib/api.js`, beside the existing media calls:

```js
export const listAlbums = () => request('/media/albums');

export const createAlbum = (body) => request('/media/albums', {
  method: 'POST',
  body: JSON.stringify(body),
});

export const updateAlbum = (id, body) => request(`/media/albums/${id}`, {
  method: 'PATCH',
  body: JSON.stringify(body),
});

export const deleteAlbum = (id) => request(`/media/albums/${id}`, { method: 'DELETE' });

export const setMediaAlbum = (key, albumId) => request(`/media/${key}/album`, {
  method: 'PUT',
  body: JSON.stringify({ albumId }),
});
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/admin/lib/api.js
git commit -m "feat: add album calls to the admin api client"
```

---

### Task 6: Multi-file upload

**Files:**
- Create: `src/admin/components/UploadQueue.jsx`
- Modify: `src/admin/pages/Media.jsx`, `src/admin/styles/pages.css`

**Interfaces:**
- Consumes: `uploadMedia(file)` from `src/admin/lib/api.js`, unchanged.
- Produces: `<UploadQueue onUploaded={fn} albumId={number|null} />`.

- [ ] **Step 1: Write the component**

Create `src/admin/components/UploadQueue.jsx`:

```jsx
import { useRef, useState } from 'react';
import { uploadMedia, setMediaAlbum } from '../lib/api.js';

/**
 * Uploads several files, one request at a time.
 *
 * Sequential rather than parallel: these are camp photographs from a
 * phone, often several megabytes each, and a dozen concurrent uploads on
 * a venue's wifi is how you get a handful of opaque failures instead of a
 * slow but complete run.
 *
 * One file failing does not abandon the rest — each row carries its own
 * state, so a director can see which three of twenty need retrying rather
 * than being told "upload failed" and starting again.
 */
export default function UploadQueue({ onUploaded, albumId = null }) {
  const [queue, setQueue] = useState([]);
  const [running, setRunning] = useState(false);
  const inputRef = useRef(null);

  function update(index, patch) {
    setQueue((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function handleFiles(event) {
    const files = [...(event.target.files ?? [])];
    if (files.length === 0) return;

    const started = files.map((file) => ({ name: file.name, state: 'waiting', error: null }));
    setQueue(started);
    setRunning(true);

    for (let i = 0; i < files.length; i += 1) {
      update(i, { state: 'uploading' });
      try {
        const { media } = await uploadMedia(files[i]);
        // Placing into the album is a second call rather than an upload
        // parameter: storeUpload deliberately takes nothing that could
        // affect where a row lands, and that is worth keeping.
        if (albumId !== null) await setMediaAlbum(media.key, albumId);
        update(i, { state: 'done' });
      } catch (err) {
        update(i, { state: 'failed', error: err.message });
      }
    }

    setRunning(false);
    // Clear the input so choosing the same files again still fires a
    // change event — the browser treats an identical selection as a no-op.
    if (inputRef.current) inputRef.current.value = '';
    onUploaded?.();
  }

  const done = queue.filter((r) => r.state === 'done').length;
  const failed = queue.filter((r) => r.state === 'failed');

  return (
    <div className="upload-queue">
      <label className="admin-upload">
        <span>{running ? 'Uploading…' : 'Choose photos or videos'}</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4"
          disabled={running}
          onChange={handleFiles}
        />
      </label>

      {queue.length > 0 && (
        <>
          <p className="upload-queue__summary" aria-live="polite">
            {done} of {queue.length} uploaded
            {failed.length > 0 ? `, ${failed.length} failed` : ''}
            {running ? '' : '. Everything uploaded is private until you publish it.'}
          </p>
          <ul className="upload-queue__list">
            {queue.map((row) => (
              <li key={row.name} className={`upload-queue__row upload-queue__row--${row.state}`}>
                <span className="upload-queue__name">{row.name}</span>
                <span className="upload-queue__state">
                  {row.state === 'failed' ? row.error : row.state}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Style it**

Append to `src/admin/styles/pages.css`:

```css
/* --- Upload queue ------------------------------------------------------ */

.upload-queue__summary {
  margin: 0.75rem 0 0.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-ink-soft);
}

.upload-queue__list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-width: 40rem;
}

.upload-queue__row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--color-line);
  font-size: 0.875rem;
}

.upload-queue__name {
  font-weight: 600;
  word-break: break-word;
}

.upload-queue__state { color: var(--color-muted); }

/* Failures are marked with the accent rule used elsewhere for attention,
   not with a red fill — the panel has no filled status colours. */
.upload-queue__row--failed { border-left: 3px solid var(--color-accent); padding-left: 0.5rem; }
.upload-queue__row--failed .upload-queue__state { color: var(--color-accent); }
.upload-queue__row--done .upload-queue__state { color: var(--color-signal); }
```

- [ ] **Step 3: Use it in Media.jsx**

In `src/admin/pages/Media.jsx`, import the component:

```jsx
import UploadQueue from '../components/UploadQueue.jsx';
```

Replace the existing single-file `<label className="admin-upload">` block
and its `handleUpload` function with:

```jsx
      <UploadQueue onUploaded={() => refresh().catch((err) => setError(err.message))} />
```

Delete the now-unused `handleUpload`, `fileInputRef`, and the `'upload'`
pending key. Leave every other handler alone.

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: succeeds with no unused-variable errors.

- [ ] **Step 5: Commit**

```bash
git add src/admin/components/UploadQueue.jsx src/admin/pages/Media.jsx src/admin/styles/pages.css
git commit -m "feat: upload several files at once, one at a time"
```

---

### Task 7: Album UI and video rendering

**Files:**
- Create: `src/admin/components/AlbumBar.jsx`
- Modify: `src/admin/pages/Media.jsx`, `src/admin/styles/pages.css`

**Interfaces:**
- Consumes: `listAlbums`, `createAlbum`, `deleteAlbum` from the api client; `Busy`, `Failure`, `Empty` from `src/admin/components/States.jsx`.
- Produces: `<AlbumBar albums={[]} selected={id|null} onSelect={fn} onCreated={fn} />`.

- [ ] **Step 1: Write the album bar**

Create `src/admin/components/AlbumBar.jsx`:

```jsx
import { useState } from 'react';
import { createAlbum } from '../lib/api.js';

/**
 * Album filter and creation.
 *
 * "All" is always first and always available: an album is a filter over
 * one library, not a separate library, and a director must never have to
 * guess which album a photo landed in to find it again.
 */
export default function AlbumBar({ albums, selected, onSelect, onCreated }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleCreate(event) {
    event.preventDefault();
    if (title.trim() === '') return;
    setBusy(true);
    setError(null);
    try {
      await createAlbum({ title });
      setTitle('');
      onCreated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="album-bar">
      <div className="album-bar__filters" role="group" aria-label="Filter by album">
        <button
          type="button"
          className={selected === null ? 'album-chip album-chip--active' : 'album-chip'}
          aria-pressed={selected === null}
          onClick={() => onSelect(null)}
        >
          All
        </button>
        {albums.map((album) => (
          <button
            key={album.id}
            type="button"
            className={selected === album.id ? 'album-chip album-chip--active' : 'album-chip'}
            aria-pressed={selected === album.id}
            onClick={() => onSelect(album.id)}
          >
            {album.title} <span className="album-chip__count">{album.item_count}</span>
          </button>
        ))}
      </div>

      <form className="album-bar__create" onSubmit={handleCreate}>
        <label className="admin-field">
          New album
          <input
            type="text"
            name="albumTitle"
            value={title}
            placeholder="Session 1"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <button type="submit" className="admin-add" disabled={busy || title.trim() === ''}>
          Add album
        </button>
      </form>

      {error && <p className="admin-error" role="alert">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Style it**

Append to `src/admin/styles/pages.css`:

```css
/* --- Albums ------------------------------------------------------------ */

.album-bar {
  margin: 1.25rem 0;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--color-line);
}

.album-bar__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 1rem;
}

/* Square-cornered, in keeping with the 2-6px radii used throughout — these
   are filter buttons, not pills. */
.album-chip {
  border: 1px solid var(--color-line-strong);
  border-radius: 2px;
  background: var(--color-surface-raised);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-ink-soft);
  padding: 0.35rem 0.7rem;
  cursor: pointer;
}

.album-chip:hover { border-color: var(--color-ink); }

.album-chip:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.album-chip--active {
  border-color: var(--color-primary);
  background: var(--color-surface-sunken);
  color: var(--color-ink);
}

.album-chip__count {
  font-weight: 400;
  color: var(--color-muted);
}

.album-bar__create {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem;
}

/* Video preview, sized to match the photo thumbnails exactly so a mixed
   library stays on one grid. */
.media-row__preview video {
  display: block;
  width: 120px;
  height: 120px;
  object-fit: cover;
  border: 1px solid var(--color-line);
  border-radius: 2px;
  background: var(--color-ink);
}
```

- [ ] **Step 3: Wire it into Media.jsx**

In `src/admin/pages/Media.jsx`:

Import at the top:

```jsx
import AlbumBar from '../components/AlbumBar.jsx';
import { listAlbums } from '../lib/api.js';
```

Add state beside the existing declarations:

```jsx
  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
```

Extend `refresh()` to load albums alongside media:

```jsx
  async function refresh() {
    const [{ media }, { albums: albumRows }] = await Promise.all([
      listMedia(),
      listAlbums(),
    ]);
    setItems(media);
    setAlbums(albumRows);
    setAltDrafts((prev) => {
      const next = { ...prev };
      for (const item of media) {
        if (!(item.key in next)) next[item.key] = item.alt_text ?? '';
      }
      return next;
    });
  }
```

Render the bar above the private/public groups:

```jsx
      <AlbumBar
        albums={albums}
        selected={selectedAlbum}
        onSelect={setSelectedAlbum}
        onCreated={() => refresh().catch((err) => setError(err.message))}
      />
```

Filter the rows the groups render. Find where the component splits `items`
into private and public, and apply the album filter to `items` first:

```jsx
  // An album is a filter over the one library, so this narrows what is
  // shown without changing the private/public split below it.
  const visible = selectedAlbum === null
    ? items
    : items.filter((item) => item.album_id === selectedAlbum);
```

Then use `visible` wherever `items` was used for the two groups.

- [ ] **Step 4: Render video in the preview**

In `src/admin/pages/Media.jsx`, find the `media-row__preview` block. It
currently renders an `<img>` for public rows and a placeholder for private
ones. Change the public branch to pick by type:

```jsx
        {item.status === 'public' ? (
          item.content_type.startsWith('video/') ? (
            <video src={`/media/${item.key}`} controls preload="metadata" />
          ) : (
            <img src={`/media/${item.key}`} alt={item.alt_text ?? ''} />
          )
        ) : (
          <span className="media-row__placeholder">
            Private — no preview
          </span>
        )}
```

Keep the private placeholder exactly as it is. A private video has no
public URL for the same reason a private photo does not, and adding one
would undo the private/public split.

- [ ] **Step 5: Build**

```bash
npm run build
```

Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/admin/components/AlbumBar.jsx src/admin/pages/Media.jsx src/admin/styles/pages.css
git commit -m "feat: filter media by album and preview video"
```

---

### Task 8: Full suite and browser verification

**Files:** none, unless a defect is found.

- [ ] **Step 1: Run everything**

```bash
npm test
```

Expected: all pass, including every pre-existing media suite. Do not
continue with a red suite.

- [ ] **Step 2: Start both servers**

```bash
npx wrangler dev --port 8788 &
npm run dev
```

- [ ] **Step 3: Verify in a browser**

The admin panel needs a Cloudflare Access JWT that does not exist on
localhost, so use `admin-preview.html` (gitignored, created in phase 1)
and extend its `FIXTURES` map with `/api/admin/media` and
`/api/admin/media/albums` responses. Include at least one private photo,
one public photo, one video, and one empty album.

Check at 375px and 1280px:

| What | Must be true |
|---|---|
| Album chips | Wrap rather than overflow at 375px; "All" is first; the active chip is marked by border and surface, not a fill |
| Upload queue | Rows list each filename with its state; a failed row is marked by the accent rule |
| Video row | Preview is 120×120 and aligns with photo thumbnails on the same grid |
| Private rows | Still show the placeholder, never a `<video>` or `<img>` pointing at `/media/:key` |
| Empty album | Selecting it shows the empty state, not a blank page |

- [ ] **Step 4: Read the console**

Expected: no errors, no React warnings. A key warning on the queue rows
would be real — filenames are the key and two files can share one.

- [ ] **Step 5: Confirm the bans hold**

No shadows, gradients, uppercase headings, pill buttons or hover lifts.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A src/admin worker
git commit -m "fix: <what the browser pass found>"
```

Skip if nothing was found.

---

## Self-Review

**Spec coverage.** Section 2 lists four requirements. Albums → Tasks 1, 2,
4, 7. Multi-file upload → Task 6. Video → Tasks 3 and 7. Bulk
publish/unpublish → **not covered**; see below. The rule that private
media has no public URL is pinned by Task 7 Step 4 keeping the placeholder,
and by the existing `media-adversarial` suite which Task 3 Step 5 re-runs.

**Deliberate deferral.** The spec's bulk select for publish/unpublish is
not in this plan. Publishing is the one action in this feature that can
expose a child's photograph, and the existing single-item flow asks for a
confirmation naming the consequence each time. A bulk version needs its
own thinking about what that confirmation says when it covers twenty
photographs, and it should not ride along at the end of a plan about
grouping and upload. It is worth its own task after this ships, and the
album filter added here is what would make it safe — a bulk action scoped
to a visible album beats one scoped to "everything on screen".

**Placeholders.** None. Every step carries literal code or a literal
command with its expected result.

**Type consistency.** `listAlbums`/`createAlbum`/`updateAlbum`/
`deleteAlbum`/`setMediaAlbum` keep the same names and signatures in the
repository (Task 2), the routes (Task 4), the client (Task 5) and the UI
(Tasks 6-7). `isVideo` and `MAX_UPLOAD_BYTES_VIDEO` are defined in Task 3
and consumed by its own tests. `item_count` is produced by `listAlbums`
and read by `AlbumBar`.

**Risk noted.** Task 3 reorders `assertValidUpload` so the allowlist check
precedes the size check. That is required — the limit is chosen from the
declared type — but it changes which error an unknown oversized type
returns, from 413 to 400. Task 3 Step 5 re-runs the four existing media
suites specifically to catch that.
