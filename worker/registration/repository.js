/**
 * Registration rows.
 *
 * The rule this module exists to hold: a draft can be edited by whoever
 * has its reference, and a confirmed registration cannot. `status` and
 * `deposit_paid_cents` are not writable here at all — the Stripe webhook
 * owns those, and a form field named `status` must not become a second
 * path to a paid place at camp.
 *
 * No health data passes through here. See the migration comment and
 * docs/superpowers/specs/2026-09-04-registration-design.md.
 */

export class RegistrationError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   */
  constructor(message, status) {
    super(message);
    this.name = 'RegistrationError';
    this.status = status;
  }
}

/**
 * A short code a guardian can read down a phone line.
 *
 * Crockford-ish alphabet: no I, O or L, which are misread as 1 and 0,
 * and no U, which turns short random strings into words nobody wants to
 * read out. 8 characters from 30 is ~40 bits — enough that guessing
 * another family's registration is impractical.
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

function newReference() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** The columns a draft may set, mapped from camelCase input. */
const WRITABLE = {
  guardianName: 'guardian_name',
  guardianEmail: 'guardian_email',
  guardianPhone: 'guardian_phone',
  addressLine1: 'address_line1',
  addressCity: 'address_city',
  addressState: 'address_state',
  addressPostal: 'address_postal',
  emergencyName: 'emergency_name',
  emergencyPhone: 'emergency_phone',
  camperName: 'camper_name',
  camperDob: 'camper_dob',
  camperSchool: 'camper_school',
  camperGrade: 'camper_grade',
  busRoute: 'bus_route',
  shirtSize: 'shirt_size',
  photoConsent: 'photo_consent',
};

/**
 * Reduces input to the columns above. Anything else — `status`,
 * `deposit_paid_cents`, `total_cents`, `reference` — is dropped rather
 * than rejected: a client sending them is not necessarily hostile, but
 * must never be obeyed.
 */
function writableFields(fields) {
  const out = {};
  for (const [key, column] of Object.entries(WRITABLE)) {
    if (fields[key] === undefined) continue;
    out[column] = key === 'photoConsent'
      // Only a literal true consents. A truthy string must not grant
      // consent on a family's behalf.
      ? (fields[key] === true ? 1 : 0)
      : fields[key];
  }
  return out;
}

export async function createDraft(db, fields = {}) {
  const columns = writableFields(fields);
  const names = ['reference', ...Object.keys(columns)];
  const values = [newReference(), ...Object.values(columns)];

  return db.prepare(
    `INSERT INTO registrations (${names.join(', ')})
     VALUES (${names.map(() => '?').join(', ')})
     RETURNING *`,
  ).bind(...values).first();
}

export async function getByReference(db, reference) {
  const row = await db.prepare('SELECT * FROM registrations WHERE reference = ?')
    .bind(String(reference ?? '')).first();
  return row ?? null;
}

/**
 * Updates a draft. Refuses once the registration is confirmed — someone
 * cannot change which camper is coming after paying for the place.
 */
export async function updateDraft(db, reference, fields) {
  const existing = await getByReference(db, reference);
  if (existing === null) return null;

  if (existing.status !== 'draft') {
    throw new RegistrationError(
      'This registration is already confirmed and cannot be changed here.',
      409,
    );
  }

  const columns = writableFields(fields);
  if (Object.keys(columns).length === 0) return existing;

  const assignments = Object.keys(columns).map((column) => `${column} = ?`).join(', ');
  return db.prepare(
    `UPDATE registrations SET ${assignments} WHERE reference = ? RETURNING *`,
  ).bind(...Object.values(columns), existing.reference).first();
}

/**
 * How many confirmed registrations this guardian already has, which is
 * the sibling index for the next one. Drafts do not count: a family
 * cannot earn the discount by opening tabs.
 */
export async function confirmedSiblingCount(db, guardianEmail) {
  const row = await db.prepare(
    `SELECT COUNT(*) AS n FROM registrations
     WHERE LOWER(guardian_email) = LOWER(?) AND status = 'confirmed'`,
  ).bind(String(guardianEmail ?? '')).first();
  return row?.n ?? 0;
}

export async function listRegistrations(db, { status }) {
  const { results } = await db.prepare(
    'SELECT * FROM registrations WHERE status = ? ORDER BY created_at DESC',
  ).bind(status).all();
  return results;
}

export async function cancelRegistration(db, reference) {
  const row = await db.prepare(
    `UPDATE registrations
     SET status = 'cancelled', cancelled_at = COALESCE(cancelled_at, unixepoch())
     WHERE reference = ?
     RETURNING *`,
  ).bind(String(reference ?? '')).first();
  return row ?? null;
}

/**
 * Records a completed payment and confirms the registration.
 *
 * Idempotent by the UNIQUE on stripe_session_id: Stripe retries an event
 * until it is acknowledged, and the second delivery must not pay twice.
 * The insert is attempted first, and a conflict means this event has
 * already been handled — so it returns without touching the registration
 * again.
 *
 * This is the only function that sets status = 'confirmed'.
 */
export async function recordPayment(db, {
  reference, sessionId, paymentIntent, amountCents,
}) {
  const registration = await getByReference(db, reference);
  if (registration === null) {
    console.error(`Payment for unknown registration reference: ${reference}`);
    return null;
  }

  const inserted = await db.prepare(
    `INSERT INTO payments
       (registration_id, stripe_session_id, stripe_payment_intent, amount_cents, status)
     VALUES (?, ?, ?, ?, 'paid')
     ON CONFLICT(stripe_session_id) DO NOTHING
     RETURNING *`,
  ).bind(registration.id, sessionId, paymentIntent ?? null, amountCents).first();

  // No row means the conflict fired: this session was already recorded,
  // so the registration must not be paid a second time.
  if (inserted === null) return registration;

  const confirmed = await db.prepare(
    `UPDATE registrations
     SET status = 'confirmed',
         confirmed_at = COALESCE(confirmed_at, unixepoch()),
         deposit_paid_cents = deposit_paid_cents + ?
     WHERE id = ?
     RETURNING *`,
  ).bind(amountCents, registration.id).first();

  // A confirmed registration joins the camper roster. Consent carries
  // over exactly as the guardian gave it — photo_consent defaults to 0,
  // so silence stays a no. See worker/faces/roster.js.
  //
  // The bib is a placeholder: a camper has no number until the camp
  // assigns one, and the roster needs a unique key. A director renames it
  // in the Face tagging tab when bibs are handed out.
  if (confirmed.camper_name) {
    const consented = confirmed.photo_consent === 1;
    await db.prepare(
      `INSERT INTO campers (bib, name, created_by, consent_at, consent_by)
       VALUES (?, ?, 'registration', ?, ?)
       ON CONFLICT(bib) DO NOTHING`,
    ).bind(
      `reg-${confirmed.reference}`,
      confirmed.camper_name,
      consented ? Math.floor(Date.now() / 1000) : null,
      consented ? (confirmed.guardian_email ?? 'registration') : null,
    ).run();
  }

  return confirmed;
}
