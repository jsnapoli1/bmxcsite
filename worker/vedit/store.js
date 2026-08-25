/**
 * A `VeditServerStore` (see vedit/server) backed by D1.
 *
 * The interface vedit asks for is two required methods — `read(key, stage)`
 * and `write(doc, stage)` — plus optional `list`, `listVersions` and
 * `readVersion`. Implementing the optional three is what switches on the
 * History panel in the editor, which is worth having: a design change that
 * makes a page worse should be recoverable without a deploy.
 *
 * Documents are stored as opaque JSON. This module never inspects their
 * interior — see the note in migrations/0005_vedit.sql for why.
 */

/** Kept in step with the CHECK constraint on vedit_documents.stage. */
const STAGES = Object.freeze(['draft', 'published']);

export class UnknownStageError extends Error {
  constructor(stage) {
    super(`Unknown document stage: ${stage}`);
    this.name = 'UnknownStageError';
    this.status = 400;
  }
}

/**
 * A stage the D1 CHECK constraint would reject is rejected here first, with
 * a name, rather than surfacing as an opaque constraint failure (a 500) from
 * deep inside the driver.
 */
function assertKnownStage(stage) {
  if (!STAGES.includes(stage)) {
    throw new UnknownStageError(stage);
  }
}

/**
 * Documents whose text will not parse are treated as absent rather than
 * thrown.
 *
 * A row can only become unparseable through corruption or a direct SQL
 * edit — never through `write`, which serialises with JSON.stringify. When
 * it does happen, answering "no document" degrades to the page rendering
 * its original hand-written design, which is always a valid page. Throwing
 * would instead take the page down entirely, turning a cosmetic-override
 * problem into an outage.
 */
function parseDocument(row, key) {
  if (!row) return null;
  try {
    return JSON.parse(row.doc);
  } catch (error) {
    console.error(`vedit document ${key} did not parse: ${error?.message ?? error}`);
    return null;
  }
}

/**
 * Build a store bound to a D1 database.
 *
 * `actorEmail` is stamped onto every write so the audit trail and the
 * History panel can say who made a change. It is captured per-request by
 * the route, never global.
 */
export function d1Store(db, actorEmail = null) {
  return {
    async read(key, stage = 'published') {
      assertKnownStage(stage);
      const row = await db
        .prepare('SELECT doc FROM vedit_documents WHERE key = ? AND stage = ?')
        .bind(key, stage)
        .first();
      return parseDocument(row, key);
    },

    async write(doc, stage = 'published') {
      assertKnownStage(stage);
      const json = JSON.stringify(doc);

      // A publish writes the live document and appends a history entry. Both
      // or neither: a batch is one D1 transaction, so a failure partway
      // cannot leave a published change with no way back to the previous
      // version. Drafts are not versioned — they are saved continuously
      // while someone works, and a history entry per keystroke-batch would
      // bury the entries that matter.
      const upsert = db.prepare(
        `INSERT INTO vedit_documents (key, stage, doc, updated_at, updated_by)
         VALUES (?, ?, ?, unixepoch(), ?)
         ON CONFLICT (key, stage) DO UPDATE SET
           doc = excluded.doc,
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by`,
      ).bind(doc.key, stage, json, actorEmail);

      if (stage !== 'published') {
        await upsert.run();
        return;
      }

      await db.batch([
        upsert,
        db.prepare(
          `INSERT INTO vedit_versions (key, doc, created_by)
           VALUES (?, ?, ?)`,
        ).bind(doc.key, json, actorEmail),
      ]);
    },

    /** Which pages have been edited. Drives `GET /v1/documents` in the API. */
    async list() {
      const { results } = await db.prepare(
        `SELECT key, MAX(updated_at) AS updated_at
           FROM vedit_documents
          GROUP BY key
          ORDER BY key`,
      ).all();

      return results.map((row) => ({
        key: row.key,
        // vedit's DocumentSummary expects an ISO string; D1 stores a unix
        // second, which is what unixepoch() yields.
        updatedAt: new Date(row.updated_at * 1000).toISOString(),
      }));
    },

    async listVersions(key) {
      const { results } = await db.prepare(
        `SELECT id, created_at, created_by
           FROM vedit_versions
          WHERE key = ?
          ORDER BY created_at DESC, id DESC
          LIMIT 50`,
      ).bind(key).all();

      return results.map((row) => ({
        id: String(row.id),
        createdAt: new Date(row.created_at * 1000).toISOString(),
        label: row.created_by ?? undefined,
      }));
    },

    async readVersion(key, versionId) {
      // versionId arrives as a string from the URL. A non-numeric one is a
      // malformed request, not a missing version, but both answer null —
      // the caller's only useful response either way is "that version isn't
      // there". Binding it unparsed would make SQLite coerce it silently.
      const id = Number(versionId);
      if (!Number.isInteger(id)) return null;

      const row = await db
        .prepare('SELECT doc FROM vedit_versions WHERE id = ? AND key = ?')
        .bind(id, key)
        .first();
      return parseDocument(row, key);
    },
  };
}
