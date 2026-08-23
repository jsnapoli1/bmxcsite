/**
 * Validates uploads, writes them to R2, and decides what may be served
 * publicly.
 *
 * This is the security core of the media feature. Some camp photos show
 * individually identifiable minors, and this site is about children — a
 * feature that can accidentally publish a child's photograph is worse than
 * no feature. Two rules follow from that, and neither is negotiable:
 *
 * 1. The `media` row in D1 is the sole authority on what is public.
 *    `getPublicObject` reads the row FIRST and returns `null` unless
 *    `status === 'public'`. It never serves based on an object's mere
 *    existence in the bucket — an orphan left in `public/` by a partial
 *    failure must stay unreachable.
 * 2. There is no publish-on-upload path. `storeUpload` always writes to
 *    `private/` and always inserts `status = 'private'`. Publishing is a
 *    separate, deliberate, attributable action (`publishMedia`).
 *
 * When a check is ambiguous, deny.
 */

/** Largest upload this repository will accept, in bytes. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Content types this repository will accept, matched against magic bytes. */
export const ALLOWED_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);

const EXTENSIONS_BY_TYPE = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
});

const PRIVATE_PREFIX = 'private/';
const PUBLIC_PREFIX = 'public/';

export class UploadError extends Error {
  /**
   * @param {string} message
   * @param {400 | 413} status
   */
  constructor(message, status) {
    super(message);
    this.name = 'UploadError';
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// magic-byte verification — the declared Content-Type is never trusted
// ---------------------------------------------------------------------------

function startsWith(bytes, signature, offset = 0) {
  if (bytes.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
}

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50]; // "WEBP"

/**
 * Sniffs `bytes` against every known signature and returns the content
 * type they actually match, or `null` if they match none of them. This is
 * independent of any declared/claimed content type — the caller compares
 * the two.
 */
function sniffContentType(bytes) {
  if (startsWith(bytes, JPEG_SIGNATURE)) return 'image/jpeg';
  if (startsWith(bytes, PNG_SIGNATURE)) return 'image/png';
  if (startsWith(bytes, RIFF_SIGNATURE) && startsWith(bytes, WEBP_SIGNATURE, 8)) {
    return 'image/webp';
  }
  return null;
}

/**
 * Validates size, declared type, and actual magic bytes. Throws
 * `UploadError` (413 for size, 400 for anything else) rather than
 * returning a result, so a caller can never accidentally continue past an
 * invalid upload by forgetting to check a return value.
 */
function assertValidUpload(bytes, contentType) {
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new UploadError(
      `File is ${bytes.byteLength} bytes, over the ${MAX_UPLOAD_BYTES}-byte limit.`,
      413,
    );
  }

  // Strict membership check — only these three literal strings pass.
  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new UploadError(`Content type "${contentType}" is not allowed.`, 400);
  }

  const actualType = sniffContentType(bytes);
  if (actualType === null) {
    throw new UploadError('File content does not match any allowed image type.', 400);
  }
  if (actualType !== contentType) {
    throw new UploadError(
      `Declared content type "${contentType}" does not match file contents (looks like "${actualType}").`,
      400,
    );
  }
}

// ---------------------------------------------------------------------------
// key generation — never derived from the user-supplied filename
// ---------------------------------------------------------------------------

/**
 * Generates a storage key from a random UUID plus an extension taken from
 * the *validated* content type. The filename is never consulted here: a
 * user-supplied filename becoming part of a storage path is a
 * path-traversal vector, so it is stored only in the `filename` column,
 * for display.
 */
function generateKey(contentType) {
  return `${crypto.randomUUID()}.${EXTENSIONS_BY_TYPE[contentType]}`;
}

// ---------------------------------------------------------------------------
// storeUpload — always private, never publish-on-upload
// ---------------------------------------------------------------------------

/**
 * Validates `bytes`/`contentType`, writes the object to `private/<key>`,
 * then inserts the `media` row as `status = 'private'`. Writes R2 first so
 * the insert's `key` always refers to something that exists; if the insert
 * fails (e.g. a key collision), the just-written R2 object is deleted
 * before rethrowing, so a failed upload never leaves an orphan nobody
 * knows about.
 *
 * There is deliberately no parameter that can make this insert as public.
 * Publishing is only ever done by `publishMedia`.
 */
export async function storeUpload(env, {
  bytes, filename, contentType, uploaderEmail,
}) {
  assertValidUpload(bytes, contentType);

  const key = generateKey(contentType);

  await env.MEDIA.put(`${PRIVATE_PREFIX}${key}`, bytes, {
    httpMetadata: { contentType },
  });

  try {
    const row = await env.DB.prepare(
      `INSERT INTO media (key, filename, content_type, size_bytes, uploaded_by)
       VALUES (?, ?, ?, ?, ?)
       RETURNING *`,
    ).bind(key, filename, contentType, bytes.byteLength, uploaderEmail).first();

    return row;
  } catch (error) {
    // The insert failed (e.g. a UUID collision) — the object we just wrote
    // is now unreferenced by any row. Delete it rather than leave an
    // orphan nobody knows about, then rethrow the original error.
    await env.MEDIA.delete(`${PRIVATE_PREFIX}${key}`);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// listMedia
// ---------------------------------------------------------------------------

/** Rows for a given status ('private' or 'public'), newest upload first. */
export async function listMedia(db, { status }) {
  const { results } = await db.prepare(
    'SELECT * FROM media WHERE status = ? ORDER BY uploaded_at DESC',
  ).bind(status).all();
  return results;
}

// ---------------------------------------------------------------------------
// publish / unpublish — the only path from private to public
// ---------------------------------------------------------------------------

/**
 * Copies `private/<key>` to `public/<key>` and flips the row to
 * `status = 'public'`, recording who did it and when. This is the only
 * function in this module that can make an object publicly reachable —
 * `storeUpload` never does.
 */
export async function publishMedia(env, key, editorEmail) {
  const object = await env.MEDIA.get(`${PRIVATE_PREFIX}${key}`);
  if (object === null) {
    throw new UploadError(`No private object found for key "${key}".`, 400);
  }

  await env.MEDIA.put(`${PUBLIC_PREFIX}${key}`, object.body, {
    httpMetadata: object.httpMetadata,
  });

  const row = await env.DB.prepare(
    `UPDATE media
     SET status = 'public', published_at = unixepoch(), published_by = ?
     WHERE key = ?
     RETURNING *`,
  ).bind(editorEmail, key).first();

  return row;
}

/**
 * Deletes the `public/<key>` object and flips the row back to
 * `status = 'private'`. The `private/<key>` object is untouched — it was
 * never deleted by publishing, so unpublishing needs only remove the
 * public copy.
 */
export async function unpublishMedia(env, key, editorEmail) {
  await env.MEDIA.delete(`${PUBLIC_PREFIX}${key}`);

  const row = await env.DB.prepare(
    `UPDATE media
     SET status = 'private', published_at = NULL, published_by = ?
     WHERE key = ?
     RETURNING *`,
  ).bind(editorEmail, key).first();

  return row;
}

// ---------------------------------------------------------------------------
// getPublicObject — the database is the authority, not the bucket
// ---------------------------------------------------------------------------

/**
 * Returns the `public/<key>` R2 object, or `null` if it should not be
 * served. The `media` row is read FIRST, and only a literal
 * `status === 'public'` allows the R2 read to happen at all — an object
 * that merely exists at `public/<key>` (e.g. an orphan left by a partial
 * failure) is never served on that basis alone. When the row's status
 * check is ambiguous or fails, this denies (returns `null`).
 */
export async function getPublicObject(env, key) {
  const row = await env.DB.prepare(
    'SELECT status FROM media WHERE key = ?',
  ).bind(key).first();

  // Strict boolean check, not a truthiness shortcut: only the literal
  // string 'public' passes. A missing row, a null status, or any other
  // value denies.
  if (row?.status !== 'public') {
    return null;
  }

  return env.MEDIA.get(`${PUBLIC_PREFIX}${key}`);
}
