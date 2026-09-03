/**
 * Newsletter subscribers, with double opt-in.
 *
 * The confirmation email this triggers is transactional — the person just
 * asked for it. Announcements to the confirmed list are deliberately not
 * sendable from here: Cloudflare Email Service is transactional-only, and
 * a broadcast through it would put the domain's sending reputation, which
 * those confirmations depend on, at risk. The list is exported instead.
 */

export class SubscriberError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   */
  constructor(message, status) {
    super(message);
    this.name = 'SubscriberError';
    this.status = status;
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 256 bits of randomness. This is a bearer credential, not an id. */
function newToken() {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

/**
 * Records a pending subscription and returns the token to email.
 *
 * An address already on the list is not an error and does not say so: a
 * different answer for a known address would turn this public endpoint
 * into a way to test whether a given person is subscribed. Either way the
 * token rotates, which also invalidates any older link.
 *
 * An already-confirmed subscriber stays confirmed — re-submitting the
 * form must not silently un-confirm someone.
 */
export async function subscribe(db, email) {
  const normalised = String(email ?? '').trim().toLowerCase();
  if (!EMAIL.test(normalised)) {
    throw new SubscriberError('That is not a valid email address.', 400);
  }

  const token = newToken();

  await db.prepare(
    `INSERT INTO subscribers (email, token, status)
     VALUES (?, ?, 'pending')
     ON CONFLICT(email) DO UPDATE SET
       token = excluded.token,
       status = CASE WHEN subscribers.status = 'confirmed' THEN 'confirmed' ELSE 'pending' END`,
  ).bind(normalised, token).run();

  return { token };
}

/**
 * Confirms a subscription. Idempotent, because mail clients prefetch
 * links and a second visit must not look like a failure.
 */
export async function confirm(db, token) {
  const row = await db.prepare(
    `UPDATE subscribers
     SET status = 'confirmed',
         confirmed_at = COALESCE(confirmed_at, unixepoch())
     WHERE token = ?
     RETURNING id`,
  ).bind(String(token ?? '')).first();

  return row !== null;
}

/**
 * Unsubscribes. Never requires signing in, works on one click, and is
 * idempotent — the second click of a double-click must not error. Works
 * on a pending row too: someone who never confirmed is still entitled to
 * say stop.
 */
export async function unsubscribe(db, token) {
  const row = await db.prepare(
    `UPDATE subscribers
     SET status = 'unsubscribed',
         unsubscribed_at = COALESCE(unsubscribed_at, unixepoch())
     WHERE token = ?
     RETURNING id`,
  ).bind(String(token ?? '')).first();

  return row !== null;
}

/**
 * Subscribers with the given status.
 *
 * The columns are named rather than selected with `*` so the token never
 * leaves this module: it is an unsubscribe credential, and it has no
 * business in a list rendered to an admin or in an exported CSV.
 */
export async function listSubscribers(db, { status }) {
  const { results } = await db.prepare(
    `SELECT id, email, status, created_at, confirmed_at
     FROM subscribers
     WHERE status = ?
     ORDER BY created_at DESC`,
  ).bind(status).all();
  return results;
}

/**
 * A CSV of the list.
 *
 * Fields beginning = + - @ are prefixed with an apostrophe: Excel and
 * Sheets execute those as formulas on open, and this file exists to be
 * opened in exactly those programs.
 */
export function toCsv(rows) {
  const escape = (value) => {
    const text = String(value ?? '');
    const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
  };

  return [
    'email,confirmed_at',
    ...rows.map((row) => `${escape(row.email)},${escape(row.confirmed_at ?? '')}`),
  ].join('\n');
}
