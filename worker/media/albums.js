/**
 * Albums: an organisational grouping over media.
 *
 * Deliberately separate from repository.js, which owns the private/public
 * decision. Nothing here may change `status` — an album is a label, not a
 * permission boundary, and keeping the two modules apart is what stops a
 * grouping change from becoming a second way to publish a photograph.
 */

export class AlbumError extends Error {
  /**
   * @param {string} message
   * @param {400} status
   */
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
