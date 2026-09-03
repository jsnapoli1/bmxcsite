/**
 * The camp roster and its consent record.
 *
 * Every camper must opt in before their face may define an identity. That
 * requirement is only real if it is enforced where identities are created,
 * so `consentedRoster` and `mayEnroll` are the two functions the ingest
 * path goes through — never the full roster.
 *
 * Filtering at display time instead would fail this requirement while
 * appearing to meet it: the face templates would already have been built
 * from a child whose family never agreed.
 */

export class RosterError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   */
  constructor(message, status) {
    super(message);
    this.name = 'RosterError';
    this.status = status;
  }
}

/** Bibs are compared trimmed, so ' 204 ' and '204' are the same camper. */
function normaliseBib(bib) {
  return String(bib ?? '').trim();
}

export async function listCampers(db) {
  // Numeric first, then text: bib '9' sorts after '10' as a string, and a
  // roster ordered that way is hard to scan. The text fallback keeps
  // non-numeric bibs stable rather than collapsing them all to 0.
  const { results } = await db.prepare(
    'SELECT * FROM campers ORDER BY CAST(bib AS INTEGER), bib',
  ).all();
  return results;
}

/**
 * Adds or updates a camper. Deliberately cannot set consent: editing a
 * name must never be a path to consenting on a family's behalf, and it
 * must not silently revoke a consent already given either.
 */
export async function upsertCamper(db, { bib, name, actorEmail }) {
  const key = normaliseBib(bib);
  const trimmedName = String(name ?? '').trim();

  if (key === '') throw new RosterError('A camper needs a bib number.', 400);
  if (trimmedName === '') throw new RosterError('A camper needs a name.', 400);

  return db.prepare(
    `INSERT INTO campers (bib, name, created_by)
     VALUES (?, ?, ?)
     ON CONFLICT(bib) DO UPDATE SET name = excluded.name
     RETURNING *`,
  ).bind(key, trimmedName, actorEmail).first();
}

export async function recordConsent(db, bib, actorEmail) {
  const row = await db.prepare(
    `UPDATE campers
     SET consent_at = unixepoch(), consent_by = ?
     WHERE bib = ?
     RETURNING *`,
  ).bind(actorEmail, normaliseBib(bib)).first();
  return row ?? null;
}

/**
 * Withdraws consent. Takes effect immediately: `mayEnroll` refuses from
 * this moment, and the next rebuild drops any identity built from it.
 */
export async function withdrawConsent(db, bib, actorEmail) {
  const row = await db.prepare(
    `UPDATE campers
     SET consent_at = NULL, consent_by = ?
     WHERE bib = ?
     RETURNING *`,
  ).bind(actorEmail, normaliseBib(bib)).first();
  return row ?? null;
}

/**
 * The roster face-service is allowed to see: consenting campers only.
 *
 * This is what gets POSTed to the service's /roster, so a bib with no
 * consent is not merely un-enrolled — the service is never told the name
 * exists.
 */
export async function consentedRoster(db) {
  const { results } = await db.prepare(
    'SELECT bib, name FROM campers WHERE consent_at IS NOT NULL',
  ).all();

  return Object.fromEntries(results.map((row) => [row.bib, row.name]));
}

/** Whether this bib belongs to a camper who has consented. */
export async function mayEnroll(db, bib) {
  const key = normaliseBib(bib);
  // An empty bib must not be looked up at all: it cannot identify anyone,
  // and asking is how a blank ends up matching a stray blank row.
  if (key === '') return false;

  const row = await db.prepare(
    'SELECT consent_at FROM campers WHERE bib = ?',
  ).bind(key).first();

  // Strict null check, not truthiness: a missing camper, a missing row and
  // a withdrawn consent all deny.
  return row?.consent_at != null;
}
