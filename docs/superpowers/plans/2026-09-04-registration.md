# Camp registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A registration flow the camp owns — camper and guardian details, buses, tiered pricing, and a deposit through Stripe Checkout.

**Architecture:** Pricing is a pure module shared by the public page and the worker, and the server always recomputes it. Registrations are drafts until a signature-verified Stripe webhook confirms them. Health data is not stored (see the spec).

**Tech Stack:** D1, Hono, Stripe Checkout, React 19, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-registration-design.md`

## Global Constraints

- **No health data.** No allergies, medications, conditions or insurance
  in any table, request or log. Cloudflare signs a HIPAA BAA only with
  Enterprise customers and this account is on the Free plan.
- **Price is computed server-side and the client's number is never
  trusted.** A tampered form must not buy a camp place for a dollar.
- **Only the webhook sets `confirmed`**, and only after verifying the
  Stripe signature.
- **Webhooks are idempotent.** Stripe retries; a replay must not write a
  second payment or a second camper.
- **No card data** is stored, logged, or proxied. Checkout is hosted.
- **`run_worker_first` already covers `/api/*`** — new public routes are
  under it, so a navigation reaches the Worker rather than the SPA 404.
- **Field Guide direction** and the CLAUDE.md ban list apply.
- **Verify in a browser** at 375px and 1280px before claiming done.

---

### Task 1: Pricing module

Pure functions, no database. This is where a quiet error costs the camp
money, so it is built and tested alone first.

**Files:**
- Create: `src/lib/pricing.js`, `test/lib/pricing.test.js`
- Modify: `src/data/registration.js`

**Interfaces:**
- Produces:
  - `tierFor(date)` → `{ name, price }` from the windows in registration.js
  - `busCents(route)` → integer cents; `null`/unknown → 0
  - `quote({ date, busRoute, siblingIndex })` → `{ tier, baseCents, busCents, siblingDiscountCents, totalCents, depositCents, balanceDueCents, balanceDueAt }`
  - `DEPOSIT_CENTS`
- Consumes: `PRICE_TIERS`, `BUS_ROUTES`, `DEPOSIT` from `src/data/registration.js`.

- [ ] **Step 1: Add machine-readable windows to the data**

`PRICE_TIERS` currently carries `window: 'Jan 1 – Feb 28'` — prose. Add
month/day bounds beside it, keeping the prose for display:

```js
export const PRICE_TIERS = [
  { name: 'Early Bird', window: 'Jan 1 – Feb 28', from: '01-01', to: '02-28', discount: 100, price: BASE_PRICE - 100, highlight: true },
  { name: 'Full Rate', window: 'Mar 1 – Apr 30', from: '03-01', to: '04-30', discount: 55, price: BASE_PRICE - 55, highlight: false },
  { name: 'Late Rate', window: 'May 1 – Jun 30', from: '05-01', to: '06-30', discount: 0, price: BASE_PRICE, highlight: false },
];
```

Add a machine-readable key to the bus routes too:

```js
export const BUS_ROUTES = [
  { key: 'nj', region: 'New Jersey', stops: 'Rockaway & Woodbridge', price: 100 },
  { key: 'ny', region: 'New York', stops: 'Buffalo, Rochester & Syracuse', price: 125 },
];
```

Add the sibling discount, which currently exists only in prose:

```js
/** Off each registration after the first sharing a guardian email. */
export const SIBLING_DISCOUNT = 50;
```

- [ ] **Step 2: Write the failing test**

Create `test/lib/pricing.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { tierFor, busCents, quote, DEPOSIT_CENTS } from '../../src/lib/pricing.js';

// Dates are constructed UTC so the test does not change meaning with the
// machine's timezone — a boundary test that passes in one zone and fails
// in another is worse than no test.
const on = (iso) => new Date(`${iso}T12:00:00Z`);

describe('tierFor', () => {
  it('gives Early Bird on the first day of the window', () => {
    expect(tierFor(on('2026-01-01')).name).toBe('Early Bird');
  });

  it('gives Early Bird on the last day of the window', () => {
    expect(tierFor(on('2026-02-28')).name).toBe('Early Bird');
  });

  it('moves to Full Rate the next day', () => {
    expect(tierFor(on('2026-03-01')).name).toBe('Full Rate');
  });

  it('gives Late Rate through the end of June', () => {
    expect(tierFor(on('2026-06-30')).name).toBe('Late Rate');
  });

  it('returns null after registration closes', () => {
    // July is past the close date. The caller must refuse rather than
    // quietly charge the last known price.
    expect(tierFor(on('2026-07-01'))).toBeNull();
  });

  it('returns null before registration opens', () => {
    expect(tierFor(on('2025-12-31'))).toBeNull();
  });
});

describe('busCents', () => {
  it('prices the New Jersey route', () => expect(busCents('nj')).toBe(10000));
  it('prices the New York route', () => expect(busCents('ny')).toBe(12500));
  it('charges nothing for own transport', () => expect(busCents(null)).toBe(0));
  it('charges nothing for an unknown route', () => expect(busCents('mars')).toBe(0));
});

describe('quote', () => {
  it('prices an Early Bird with no bus', () => {
    const q = quote({ date: on('2026-01-15'), busRoute: null, siblingIndex: 0 });
    expect(q.baseCents).toBe(55500);
    expect(q.busCents).toBe(0);
    expect(q.siblingDiscountCents).toBe(0);
    expect(q.totalCents).toBe(55500);
  });

  it('adds the bus', () => {
    const q = quote({ date: on('2026-01-15'), busRoute: 'ny', siblingIndex: 0 });
    expect(q.totalCents).toBe(55500 + 12500);
  });

  it('discounts the second sibling but not the first', () => {
    const first = quote({ date: on('2026-01-15'), busRoute: null, siblingIndex: 0 });
    const second = quote({ date: on('2026-01-15'), busRoute: null, siblingIndex: 1 });
    expect(first.siblingDiscountCents).toBe(0);
    expect(second.siblingDiscountCents).toBe(5000);
    expect(second.totalCents).toBe(first.totalCents - 5000);
  });

  it('discounts the third sibling too', () => {
    const third = quote({ date: on('2026-01-15'), busRoute: null, siblingIndex: 2 });
    expect(third.siblingDiscountCents).toBe(5000);
  });

  it('always takes the same deposit', () => {
    const q = quote({ date: on('2026-01-15'), busRoute: 'nj', siblingIndex: 0 });
    expect(q.depositCents).toBe(DEPOSIT_CENTS);
    expect(q.depositCents).toBe(25000);
  });

  it('leaves the rest as a balance', () => {
    const q = quote({ date: on('2026-01-15'), busRoute: null, siblingIndex: 0 });
    expect(q.balanceDueCents).toBe(q.totalCents - q.depositCents);
  });

  it('bills the balance at the end of May for an early registration', () => {
    const q = quote({ date: on('2026-01-15'), busRoute: null, siblingIndex: 0 });
    expect(q.balanceDueAt).toBe('2026-05-31');
  });

  it('takes the whole amount at once from June', () => {
    // The camp's rule: register on June 1 or later and the full balance
    // is due at registration.
    const q = quote({ date: on('2026-06-05'), busRoute: null, siblingIndex: 0 });
    expect(q.balanceDueAt).toBe('2026-06-05');
  });

  it('refuses to quote outside the registration window', () => {
    expect(quote({ date: on('2026-08-01'), busRoute: null, siblingIndex: 0 })).toBeNull();
  });

  it('never produces a negative total', () => {
    // Defence against a future discount larger than the base price.
    const q = quote({ date: on('2026-01-15'), busRoute: null, siblingIndex: 99 });
    expect(q.totalCents).toBeGreaterThanOrEqual(0);
  });

  it('works in whole cents only', () => {
    const q = quote({ date: on('2026-03-15'), busRoute: 'ny', siblingIndex: 1 });
    for (const value of Object.values(q)) {
      if (typeof value === 'number') expect(Number.isInteger(value)).toBe(true);
    }
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

```bash
npx vitest run test/lib/pricing.test.js
```

Expected: FAIL — cannot resolve `src/lib/pricing.js`.

- [ ] **Step 4: Write the module**

Create `src/lib/pricing.js`:

```js
/**
 * What a registration costs.
 *
 * Shared by the public page and the worker, and the worker recomputes
 * from it rather than trusting anything a form sent. A price arriving in
 * a request body is a number an attacker chose.
 *
 * Money is integer cents throughout. Floating point dollars accumulate
 * error the moment a discount is applied, and this is real money.
 */
import { PRICE_TIERS, BUS_ROUTES, DEPOSIT, SIBLING_DISCOUNT } from '../data/registration.js';

export const DEPOSIT_CENTS = DEPOSIT * 100;

/** 'MM-DD' for a date, in UTC — see the note on timezones below. */
function monthDay(date) {
  // UTC deliberately. A tier boundary that shifts with the viewer's
  // timezone would price two people differently for the same instant.
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${month}-${day}`;
}

/**
 * The price tier for a date, or null outside the registration window.
 *
 * Null rather than a fallback tier: registration closing is a real state,
 * and quietly charging the last known price to someone registering in
 * August would be worse than refusing.
 */
export function tierFor(date) {
  const key = monthDay(date);
  return PRICE_TIERS.find((tier) => key >= tier.from && key <= tier.to) ?? null;
}

/** Cents for a bus route key. Unknown or absent means own transport. */
export function busCents(route) {
  const found = BUS_ROUTES.find((bus) => bus.key === route);
  return found ? found.price * 100 : 0;
}

/**
 * The full breakdown, or null outside the registration window.
 *
 * `siblingIndex` is how many registrations this guardian already has
 * confirmed — 0 for the first child, 1 for the second, and so on.
 */
export function quote({ date, busRoute, siblingIndex = 0 }) {
  const tier = tierFor(date);
  if (tier === null) return null;

  const baseCents = tier.price * 100;
  const bus = busCents(busRoute);
  const siblingDiscountCents = siblingIndex > 0 ? SIBLING_DISCOUNT * 100 : 0;

  // Clamped at zero: a future discount larger than the base price must
  // not produce a negative charge.
  const totalCents = Math.max(0, baseCents + bus - siblingDiscountCents);

  // The camp's rule: before June the deposit is taken now and the
  // balance billed at the end of May; from June 1 the whole amount is
  // due at registration.
  const year = date.getUTCFullYear();
  const isJuneOrLater = monthDay(date) >= '06-01';
  const balanceDueAt = isJuneOrLater
    ? date.toISOString().slice(0, 10)
    : `${year}-05-31`;

  return {
    tier: tier.name,
    baseCents,
    busCents: bus,
    siblingDiscountCents,
    totalCents,
    depositCents: DEPOSIT_CENTS,
    balanceDueCents: Math.max(0, totalCents - DEPOSIT_CENTS),
    balanceDueAt,
  };
}
```

- [ ] **Step 5: Run it and watch it pass**

```bash
npx vitest run test/lib/pricing.test.js
```

Expected: PASS, 22 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pricing.js src/data/registration.js test/lib/pricing.test.js
git commit -m "feat: add the registration pricing module"
```

---

### Task 2: Schema and repository

**Files:**
- Create: `migrations/0010_registrations.sql`, `worker/registration/repository.js`, `test/worker/registration-repository.test.js`

**Interfaces:**
- Produces:
  - `createDraft(db, fields)` → row
  - `updateDraft(db, reference, fields)` → row or null
  - `getByReference(db, reference)` → row or null
  - `confirmedSiblingCount(db, guardianEmail)` → integer
  - `listRegistrations(db, { status })` → rows
  - `cancelRegistration(db, reference, actorEmail)` → row or null
  - `RegistrationError` with `status`

- [ ] **Step 1: Write the migration**

Create `migrations/0010_registrations.sql`:

```sql
-- Camp registrations.
--
-- No health data: no allergies, medications, conditions or insurance.
-- Cloudflare signs a HIPAA BAA only with Enterprise customers and this
-- account is on the Free plan, so there is no contract to store a
-- minor's protected health information under. Health intake happens
-- elsewhere. See docs/superpowers/specs/2026-09-04-registration-design.md.
--
-- Money is integer cents. Dollars in floating point accumulate error the
-- moment a discount is applied.
CREATE TABLE registrations (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  reference              TEXT NOT NULL UNIQUE,
  status                 TEXT NOT NULL DEFAULT 'draft',

  guardian_name          TEXT,
  guardian_email         TEXT,
  guardian_phone         TEXT,
  address_line1          TEXT,
  address_city           TEXT,
  address_state          TEXT,
  address_postal         TEXT,
  emergency_name         TEXT,
  emergency_phone        TEXT,

  camper_name            TEXT,
  camper_dob             TEXT,
  camper_school          TEXT,
  camper_grade           TEXT,

  bus_route              TEXT,
  shirt_size             TEXT,
  -- Face tagging is opt-in, and this is where a guardian says so. The
  -- default is 0: an absent decision reads as no. See worker/faces/roster.js.
  photo_consent          INTEGER NOT NULL DEFAULT 0,

  tier                   TEXT,
  base_cents             INTEGER,
  bus_cents              INTEGER,
  sibling_discount_cents INTEGER,
  total_cents            INTEGER,
  deposit_paid_cents     INTEGER NOT NULL DEFAULT 0,
  balance_due_cents      INTEGER,
  balance_due_at         TEXT,

  created_at             INTEGER NOT NULL DEFAULT (unixepoch()),
  confirmed_at           INTEGER,
  cancelled_at           INTEGER
);

CREATE INDEX idx_registrations_status ON registrations (status, created_at DESC);
CREATE INDEX idx_registrations_guardian ON registrations (guardian_email, status);

-- One row per Stripe Checkout session.
--
-- stripe_session_id is UNIQUE, and that is what makes webhook replay
-- safe: Stripe retries an event until it is acknowledged, and the second
-- delivery must not create a second payment.
CREATE TABLE payments (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  registration_id      INTEGER NOT NULL REFERENCES registrations(id),
  stripe_session_id    TEXT NOT NULL UNIQUE,
  stripe_payment_intent TEXT,
  amount_cents         INTEGER NOT NULL,
  status               TEXT NOT NULL,
  created_at           INTEGER NOT NULL DEFAULT (unixepoch())
);
```

- [ ] **Step 2: Write the failing test**

Create `test/worker/registration-repository.test.js`:

```js
import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDraft, updateDraft, getByReference, confirmedSiblingCount,
  listRegistrations, cancelRegistration, RegistrationError,
} from '../../worker/registration/repository.js';

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM payments').run();
  await env.DB.prepare('DELETE FROM registrations').run();
});

describe('createDraft', () => {
  it('starts as a draft with a reference', async () => {
    const row = await createDraft(env.DB, { camperName: 'Alex Kim' });
    expect(row.status).toBe('draft');
    expect(row.reference).toBeTruthy();
  });

  it('gives every draft a different reference', async () => {
    const a = await createDraft(env.DB, { camperName: 'A' });
    const b = await createDraft(env.DB, { camperName: 'B' });
    expect(a.reference).not.toBe(b.reference);
  });

  it('starts with photo consent off', async () => {
    // An absent decision must read as no. Face tagging is opt-in.
    const row = await createDraft(env.DB, { camperName: 'No Consent' });
    expect(row.photo_consent).toBe(0);
  });

  it('starts with nothing paid', async () => {
    const row = await createDraft(env.DB, { camperName: 'Unpaid' });
    expect(row.deposit_paid_cents).toBe(0);
    expect(row.confirmed_at).toBeNull();
  });
});

describe('updateDraft', () => {
  it('updates the fields it is given', async () => {
    const { reference } = await createDraft(env.DB, { camperName: 'Before' });
    const row = await updateDraft(env.DB, reference, { camperName: 'After', busRoute: 'ny' });
    expect(row.camper_name).toBe('After');
    expect(row.bus_route).toBe('ny');
  });

  it('leaves fields it was not given alone', async () => {
    const { reference } = await createDraft(env.DB, { camperName: 'Keep', guardianEmail: 'g@x.com' });
    const row = await updateDraft(env.DB, reference, { busRoute: 'nj' });
    expect(row.camper_name).toBe('Keep');
    expect(row.guardian_email).toBe('g@x.com');
  });

  it('cannot set status', async () => {
    // Only the Stripe webhook may confirm. A form field named `status`
    // must not be a second path to a paid registration.
    const { reference } = await createDraft(env.DB, { camperName: 'X' });
    await updateDraft(env.DB, reference, { status: 'confirmed' });
    const row = await getByReference(env.DB, reference);
    expect(row.status).toBe('draft');
  });

  it('cannot set the amount paid', async () => {
    const { reference } = await createDraft(env.DB, { camperName: 'X' });
    await updateDraft(env.DB, reference, { depositPaidCents: 999999 });
    const row = await getByReference(env.DB, reference);
    expect(row.deposit_paid_cents).toBe(0);
  });

  it('refuses to touch a confirmed registration', async () => {
    const { reference } = await createDraft(env.DB, { camperName: 'Done' });
    await env.DB.prepare(
      "UPDATE registrations SET status = 'confirmed' WHERE reference = ?",
    ).bind(reference).run();

    await expect(
      updateDraft(env.DB, reference, { camperName: 'Changed' }),
    ).rejects.toThrow(RegistrationError);
  });

  it('returns null for a reference that does not exist', async () => {
    expect(await updateDraft(env.DB, 'NOPE', { camperName: 'X' })).toBeNull();
  });
});

describe('confirmedSiblingCount', () => {
  it('counts only confirmed registrations for that guardian', async () => {
    const a = await createDraft(env.DB, { guardianEmail: 'fam@x.com', camperName: 'One' });
    await env.DB.prepare("UPDATE registrations SET status='confirmed' WHERE id = ?").bind(a.id).run();
    await createDraft(env.DB, { guardianEmail: 'fam@x.com', camperName: 'Two (draft)' });
    await createDraft(env.DB, { guardianEmail: 'other@x.com', camperName: 'Someone else' });

    expect(await confirmedSiblingCount(env.DB, 'fam@x.com')).toBe(1);
  });

  it('is case-insensitive on the email', async () => {
    const a = await createDraft(env.DB, { guardianEmail: 'case@x.com', camperName: 'One' });
    await env.DB.prepare("UPDATE registrations SET status='confirmed' WHERE id = ?").bind(a.id).run();
    expect(await confirmedSiblingCount(env.DB, 'CASE@X.COM')).toBe(1);
  });

  it('is zero for an unknown guardian', async () => {
    expect(await confirmedSiblingCount(env.DB, 'nobody@x.com')).toBe(0);
  });
});

describe('cancelRegistration', () => {
  it('marks it cancelled and records when', async () => {
    const { reference } = await createDraft(env.DB, { camperName: 'Going' });
    const row = await cancelRegistration(env.DB, reference, 'admin@bmxc.camp');
    expect(row.status).toBe('cancelled');
    expect(row.cancelled_at).toBeGreaterThan(0);
  });

  it('returns null for an unknown reference', async () => {
    expect(await cancelRegistration(env.DB, 'NOPE', 'a@b.c')).toBeNull();
  });
});

describe('listRegistrations', () => {
  it('filters by status', async () => {
    const a = await createDraft(env.DB, { camperName: 'Confirmed one' });
    await env.DB.prepare("UPDATE registrations SET status='confirmed' WHERE id=?").bind(a.id).run();
    await createDraft(env.DB, { camperName: 'Draft one' });

    const rows = await listRegistrations(env.DB, { status: 'confirmed' });
    expect(rows).toHaveLength(1);
    expect(rows[0].camper_name).toBe('Confirmed one');
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

```bash
npx vitest run test/worker/registration-repository.test.js
```

Expected: FAIL — no table, no module.

- [ ] **Step 4: Write the repository**

Create `worker/registration/repository.js`:

```js
/**
 * Registration rows.
 *
 * The rule this module exists to hold: a draft can be edited by whoever
 * has its reference, and a confirmed registration cannot. `status` and
 * `deposit_paid_cents` are not writable here at all — the Stripe webhook
 * owns those, and a form field named `status` must not become a second
 * path to a paid place at camp.
 */

export class RegistrationError extends Error {
  /** @param {string} message @param {number} status */
  constructor(message, status) {
    super(message);
    this.name = 'RegistrationError';
    this.status = status;
  }
}

/**
 * A short code a guardian can read down a phone line.
 *
 * Crockford-ish alphabet: no I, O, L, U — the first three to avoid 1/0
 * confusion, U because it turns short random strings into words nobody
 * wants to read out.
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
 * `deposit_paid_cents`, `reference` — is dropped rather than rejected,
 * because a client sending them is not necessarily hostile, but must
 * never be obeyed.
 */
function writableFields(fields) {
  const out = {};
  for (const [key, column] of Object.entries(WRITABLE)) {
    if (fields[key] === undefined) continue;
    out[column] = key === 'photoConsent'
      // Only a literal true consents. A truthy string must not.
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
 * cannot change the camper after paying for a place.
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
```

- [ ] **Step 5: Run it and watch it pass**

```bash
npx vitest run test/worker/registration-repository.test.js
```

Expected: PASS, 16 tests.

- [ ] **Step 6: Commit**

```bash
git add migrations/0010_registrations.sql worker/registration/repository.js test/worker/registration-repository.test.js
git commit -m "feat: add the registrations schema and repository"
```

---

### Task 3: Public registration API

**Files:**
- Create: `worker/routes/registration.js`, `test/worker/registration-api.test.js`
- Modify: `worker/app.js`

**Interfaces:**
- Produces (all public, no auth):
  - `POST /api/registration` → `{ reference, quote }`
  - `PATCH /api/registration/:reference` → `{ registration, quote }`
  - `GET /api/registration/:reference` → `{ registration, quote }`

- [ ] **Step 1: Write the failing test**

Create `test/worker/registration-api.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM payments').run();
  await env.DB.prepare('DELETE FROM registrations').run();
});

async function call(method, path, body) {
  return app.fetch(new Request(`https://bmxc.camp${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  }), env);
}

describe('starting a registration', () => {
  it('needs no sign-in', async () => {
    const res = await call('POST', '/api/registration', { camperName: 'Alex' });
    expect(res.status).toBe(201);
    expect((await res.json()).reference).toBeTruthy();
  });

  it('returns a quote the server computed', async () => {
    const res = await call('POST', '/api/registration', { camperName: 'Alex' });
    const { quote } = await res.json();
    expect(quote.depositCents).toBe(25000);
  });
});

describe('a client cannot choose its own price', () => {
  it('ignores a total sent in the body', async () => {
    const created = await call('POST', '/api/registration', {
      camperName: 'Cheapskate', totalCents: 1, total_cents: 1,
    });
    const { reference } = await created.json();

    const row = await env.DB.prepare(
      'SELECT total_cents FROM registrations WHERE reference = ?',
    ).bind(reference).first();
    // Nothing has priced it yet, but the client's number must not be it.
    expect(row.total_cents).not.toBe(1);
  });

  it('ignores a status sent in the body', async () => {
    const created = await call('POST', '/api/registration', {
      camperName: 'Sneaky', status: 'confirmed',
    });
    const { reference } = await created.json();
    const row = await env.DB.prepare(
      'SELECT status FROM registrations WHERE reference = ?',
    ).bind(reference).first();
    expect(row.status).toBe('draft');
  });

  it('ignores a paid amount sent in the body', async () => {
    const created = await call('POST', '/api/registration', {
      camperName: 'Sneaky', depositPaidCents: 25000,
    });
    const { reference } = await created.json();
    const row = await env.DB.prepare(
      'SELECT deposit_paid_cents FROM registrations WHERE reference = ?',
    ).bind(reference).first();
    expect(row.deposit_paid_cents).toBe(0);
  });
});

describe('continuing a registration', () => {
  it('updates by reference', async () => {
    const { reference } = await (await call('POST', '/api/registration', { camperName: 'A' })).json();
    const res = await call('PATCH', `/api/registration/${reference}`, { busRoute: 'ny' });
    expect(res.status).toBe(200);
    expect((await res.json()).registration.bus_route).toBe('ny');
  });

  it('reprices when the bus changes', async () => {
    const { reference } = await (await call('POST', '/api/registration', { camperName: 'A' })).json();
    const res = await call('PATCH', `/api/registration/${reference}`, { busRoute: 'ny' });
    const { quote } = await res.json();
    expect(quote.busCents).toBe(12500);
  });

  it('404s an unknown reference', async () => {
    expect((await call('PATCH', '/api/registration/NOPE', { busRoute: 'ny' })).status).toBe(404);
  });

  it('does not leak another registration by guessing', async () => {
    // The reference is the only credential. It must be long enough that
    // guessing is impractical, which this pins at 8 characters.
    const { reference } = await (await call('POST', '/api/registration', { camperName: 'A' })).json();
    expect(reference.length).toBeGreaterThanOrEqual(8);
  });
});

describe('reading a registration', () => {
  it('returns it with a fresh quote', async () => {
    const { reference } = await (await call('POST', '/api/registration', {
      camperName: 'A', busRoute: 'nj',
    })).json();
    const res = await call('GET', `/api/registration/${reference}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.registration.camper_name).toBe('A');
    expect(body.quote.busCents).toBe(10000);
  });
});

describe('a browser navigating to these routes', () => {
  it('is not the SPA 404', async () => {
    // run_worker_first covers /api/*, but a test pins it: this repo has
    // already shipped a public route that 404'd for every real click.
    const { reference } = await (await call('POST', '/api/registration', { camperName: 'A' })).json();
    const res = await app.fetch(new Request(
      `https://bmxc.camp/api/registration/${reference}`,
      { headers: { Accept: 'text/html', 'Sec-Fetch-Mode': 'navigate' } },
    ), env);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run test/worker/registration-api.test.js
```

Expected: FAIL — 404s.

- [ ] **Step 3: Write the route**

Create `worker/routes/registration.js`:

```js
/**
 * The public registration API.
 *
 * No authentication: a guardian filling in a form has no account. The
 * reference is the credential — 8 random characters from a 30-character
 * alphabet, which is enough that guessing another family's registration
 * is impractical.
 *
 * Every response carries a quote the *server* computed. A price in a
 * request body is a number an attacker chose, and repository.js drops it
 * before it can reach a column.
 */
import { Hono } from 'hono';
import {
  createDraft, updateDraft, getByReference, confirmedSiblingCount,
  RegistrationError,
} from '../registration/repository.js';
import { quote } from '../../src/lib/pricing.js';

const registration = new Hono();

/** The server's own price for a row, never the client's. */
async function priceFor(db, row) {
  const siblingIndex = row.guardian_email
    ? await confirmedSiblingCount(db, row.guardian_email)
    : 0;

  return quote({
    date: new Date(),
    busRoute: row.bus_route,
    siblingIndex,
  });
}

async function readJson(c) {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

registration.post('/', async (c) => {
  const body = await readJson(c);
  if (body === null) return c.json({ error: 'Request body must be valid JSON' }, 400);

  const row = await createDraft(c.env.DB, body);
  return c.json({ reference: row.reference, registration: row, quote: await priceFor(c.env.DB, row) }, 201);
});

registration.patch('/:reference', async (c) => {
  const body = await readJson(c);
  if (body === null) return c.json({ error: 'Request body must be valid JSON' }, 400);

  let row;
  try {
    row = await updateDraft(c.env.DB, c.req.param('reference'), body);
  } catch (error) {
    if (error instanceof RegistrationError) return c.json({ error: error.message }, error.status);
    throw error;
  }

  if (row === null) return c.json({ error: 'No such registration.' }, 404);
  return c.json({ registration: row, quote: await priceFor(c.env.DB, row) });
});

registration.get('/:reference', async (c) => {
  const row = await getByReference(c.env.DB, c.req.param('reference'));
  if (row === null) return c.json({ error: 'No such registration.' }, 404);
  return c.json({ registration: row, quote: await priceFor(c.env.DB, row) });
});

export default registration;
```

- [ ] **Step 4: Mount it**

In `worker/app.js`, beside `subscribeRoutes` — public, outside
`/api/admin/*`:

```js
import registrationRoutes from './routes/registration.js';
// ...
app.route('/api/registration', registrationRoutes);
```

- [ ] **Step 5: Run it and watch it pass**

```bash
npx vitest run test/worker/registration-api.test.js
npx vitest run test/worker/
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add worker/routes/registration.js worker/app.js test/worker/registration-api.test.js
git commit -m "feat: add the public registration API"
```

---

### Task 4: Stripe Checkout and the webhook

**Files:**
- Create: `worker/registration/stripe.js`, `test/worker/registration-payment.test.js`
- Modify: `worker/routes/registration.js`, `wrangler.jsonc`

**Interfaces:**
- Produces:
  - `createCheckoutSession(env, { registration, quote, origin })` → `{ url, id }`
  - `verifyWebhook(request, secret, body)` → parsed event, throws on a bad signature
  - `POST /api/registration/:reference/checkout`
  - `POST /api/registration/webhook`

- [ ] **Step 1: Write the failing test**

Create `test/worker/registration-payment.test.js`:

```js
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';
import { signPayload } from '../../worker/registration/stripe.js';

const SECRET = 'whsec_test';

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM payments').run();
  await env.DB.prepare('DELETE FROM registrations').run();
});

afterEach(() => vi.restoreAllMocks());

const withStripe = () => ({
  ...env,
  STRIPE_SECRET_KEY: 'sk_test',
  STRIPE_WEBHOOK_SECRET: SECRET,
});

async function newDraft(testEnv) {
  const res = await app.fetch(new Request('https://bmxc.camp/api/registration', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ camperName: 'Alex', guardianEmail: 'g@x.com', busRoute: 'nj' }),
  }), testEnv);
  return (await res.json()).reference;
}

async function postWebhook(testEnv, event, { secret = SECRET, timestamp } = {}) {
  const body = JSON.stringify(event);
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const signature = await signPayload(`${ts}.${body}`, secret);
  return app.fetch(new Request('https://bmxc.camp/api/registration/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': `t=${ts},v1=${signature}`,
    },
    body,
  }), testEnv);
}

function completedEvent(reference, sessionId = 'cs_test_1') {
  return {
    id: 'evt_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        payment_intent: 'pi_1',
        amount_total: 25000,
        metadata: { reference },
      },
    },
  };
}

describe('without Stripe configured', () => {
  it('says checkout is unavailable rather than failing obscurely', async () => {
    const reference = await newDraft(env);
    const res = await app.fetch(new Request(
      `https://bmxc.camp/api/registration/${reference}/checkout`,
      { method: 'POST' },
    ), env);
    expect(res.status).toBe(503);
  });
});

describe('the webhook signature', () => {
  it('confirms a registration when the signature is valid', async () => {
    const testEnv = withStripe();
    const reference = await newDraft(testEnv);

    const res = await postWebhook(testEnv, completedEvent(reference));
    expect(res.status).toBe(200);

    const row = await env.DB.prepare(
      'SELECT status, deposit_paid_cents FROM registrations WHERE reference = ?',
    ).bind(reference).first();
    expect(row.status).toBe('confirmed');
    expect(row.deposit_paid_cents).toBe(25000);
  });

  it('rejects a forged signature and changes nothing', async () => {
    const testEnv = withStripe();
    const reference = await newDraft(testEnv);

    const res = await postWebhook(testEnv, completedEvent(reference), { secret: 'whsec_wrong' });
    expect(res.status).toBe(400);

    const row = await env.DB.prepare(
      'SELECT status FROM registrations WHERE reference = ?',
    ).bind(reference).first();
    expect(row.status).toBe('draft');
  });

  it('rejects a missing signature header', async () => {
    const testEnv = withStripe();
    const res = await app.fetch(new Request('https://bmxc.camp/api/registration/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(completedEvent('X')),
    }), testEnv);
    expect(res.status).toBe(400);
  });

  it('rejects a replayed old timestamp', async () => {
    // Stripe's own guidance: a signature valid forever is a replay
    // waiting to happen.
    const testEnv = withStripe();
    const reference = await newDraft(testEnv);
    const old = Math.floor(Date.now() / 1000) - 60 * 60;

    const res = await postWebhook(testEnv, completedEvent(reference), { timestamp: old });
    expect(res.status).toBe(400);
  });
});

describe('webhook idempotency', () => {
  it('a repeated event does not pay twice', async () => {
    const testEnv = withStripe();
    const reference = await newDraft(testEnv);

    await postWebhook(testEnv, completedEvent(reference));
    const second = await postWebhook(testEnv, completedEvent(reference));
    expect(second.status).toBe(200);

    const { results } = await env.DB.prepare('SELECT * FROM payments').all();
    expect(results).toHaveLength(1);

    const row = await env.DB.prepare(
      'SELECT deposit_paid_cents FROM registrations WHERE reference = ?',
    ).bind(reference).first();
    expect(row.deposit_paid_cents).toBe(25000);
  });
});

describe('confirming writes the camper roster', () => {
  it('records consent only when the guardian gave it', async () => {
    const testEnv = withStripe();

    const yes = await app.fetch(new Request('https://bmxc.camp/api/registration', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ camperName: 'Consented', photoConsent: true }),
    }), testEnv);
    const yesRef = (await yes.json()).reference;
    await postWebhook(testEnv, completedEvent(yesRef, 'cs_yes'));

    const no = await app.fetch(new Request('https://bmxc.camp/api/registration', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ camperName: 'Not consented', photoConsent: false }),
    }), testEnv);
    const noRef = (await no.json()).reference;
    await postWebhook(testEnv, completedEvent(noRef, 'cs_no'));

    const consented = await env.DB.prepare(
      "SELECT consent_at FROM campers WHERE name = 'Consented'",
    ).first();
    const notConsented = await env.DB.prepare(
      "SELECT consent_at FROM campers WHERE name = 'Not consented'",
    ).first();

    expect(consented?.consent_at).toBeGreaterThan(0);
    expect(notConsented?.consent_at ?? null).toBeNull();
  });
});

describe('an unknown reference in an event', () => {
  it('is acknowledged rather than retried forever', async () => {
    // Returning an error would make Stripe retry an event that can never
    // succeed. Acknowledge and log.
    const testEnv = withStripe();
    const res = await postWebhook(testEnv, completedEvent('NOSUCHREF'));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run test/worker/registration-payment.test.js
```

Expected: FAIL — no `worker/registration/stripe.js`.

- [ ] **Step 3: Write the Stripe module**

Create `worker/registration/stripe.js`:

```js
/**
 * Stripe Checkout, and the webhook that is the only writer of paid state.
 *
 * No Stripe SDK: it is a large dependency for two HTTP calls and an HMAC,
 * and the Workers runtime has WebCrypto natively. Card details never
 * reach this worker — Checkout is hosted by Stripe, which is what keeps
 * PCI scope at SAQ-A.
 */

const API = 'https://api.stripe.com/v1';

/** Reject a signature older than this. Stripe's own default. */
const TOLERANCE_SECONDS = 300;

export class StripeError extends Error {
  /** @param {string} message @param {number} status */
  constructor(message, status) {
    super(message);
    this.name = 'StripeError';
    this.status = status;
  }
}

/** HMAC-SHA256, hex encoded — the scheme Stripe signs webhooks with. */
export async function signPayload(payload, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison, so a bad signature cannot be found by timing. */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verifies the `stripe-signature` header against the raw body.
 *
 * The raw body, not a re-serialised object: JSON.stringify does not
 * guarantee byte-identical output, and a signature is over bytes.
 */
export async function verifyWebhook(signatureHeader, rawBody, secret) {
  if (!signatureHeader) throw new StripeError('Missing signature.', 400);

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => part.split('=', 2)),
  );
  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp)) throw new StripeError('Malformed signature.', 400);

  // An old signature is a replay. Stripe signs the timestamp for exactly
  // this reason.
  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > TOLERANCE_SECONDS) throw new StripeError('Signature too old.', 400);

  const expected = await signPayload(`${timestamp}.${rawBody}`, secret);
  if (!parts.v1 || !timingSafeEqual(expected, parts.v1)) {
    throw new StripeError('Signature does not match.', 400);
  }

  return JSON.parse(rawBody);
}

/**
 * Creates a hosted Checkout session for the deposit.
 *
 * The amount comes from the server's own quote. `metadata.reference` is
 * how the webhook finds the registration again — the client never gets to
 * say which registration a payment belongs to.
 */
export async function createCheckoutSession(env, { registration, quote, origin }) {
  const form = new URLSearchParams({
    mode: 'payment',
    success_url: `${origin}/api/registration/${registration.reference}/paid`,
    cancel_url: `${origin}/registration?ref=${registration.reference}`,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(quote.depositCents),
    'line_items[0][price_data][product_data][name]': 'Blue Mountain XC Camp deposit',
    'metadata[reference]': registration.reference,
  });

  if (registration.guardian_email) form.set('customer_email', registration.guardian_email);

  const res = await fetch(`${API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    // Never echo Stripe's raw error to a browser — it can name internal
    // configuration. Log it; tell the caller something plain.
    console.error(`Stripe checkout failed: ${JSON.stringify(payload?.error ?? {})}`);
    throw new StripeError('Could not start the payment.', 502);
  }

  return { id: payload.id, url: payload.url };
}
```

- [ ] **Step 4: Add the routes**

In `worker/routes/registration.js`, import and add:

```js
import { createCheckoutSession, verifyWebhook, StripeError } from '../registration/stripe.js';
import { recordPayment } from '../registration/repository.js';
```

Then the two routes:

```js
registration.post('/:reference/checkout', async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) {
    return c.json({
      error: 'Online payment is not set up yet. Please contact the camp directors.',
    }, 503);
  }

  const row = await getByReference(c.env.DB, c.req.param('reference'));
  if (row === null) return c.json({ error: 'No such registration.' }, 404);
  if (row.status !== 'draft') return c.json({ error: 'This registration is already paid.' }, 409);

  const priced = await priceFor(c.env.DB, row);
  if (priced === null) return c.json({ error: 'Registration is closed for this year.' }, 400);

  try {
    const session = await createCheckoutSession(c.env, {
      registration: row,
      quote: priced,
      origin: new URL(c.req.url).origin,
    });
    return c.json({ url: session.url });
  } catch (error) {
    if (error instanceof StripeError) return c.json({ error: error.message }, error.status);
    throw error;
  }
});

/**
 * The only writer of paid state.
 *
 * Reads the raw body before parsing: the signature is over bytes, and
 * re-serialising an object does not reproduce them.
 */
registration.post('/webhook', async (c) => {
  const rawBody = await c.req.text();

  let event;
  try {
    event = await verifyWebhook(
      c.req.header('stripe-signature'),
      rawBody,
      c.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    if (error instanceof StripeError) return c.json({ error: error.message }, error.status);
    throw error;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    await recordPayment(c.env.DB, {
      reference: session.metadata?.reference,
      sessionId: session.id,
      paymentIntent: session.payment_intent,
      amountCents: session.amount_total,
    });
  }

  // Always acknowledge a well-signed event, including one naming a
  // registration we do not have. Returning an error makes Stripe retry
  // something that can never succeed.
  return c.json({ received: true });
});
```

- [ ] **Step 5: Add `recordPayment` to the repository**

Append to `worker/registration/repository.js`:

```js
/**
 * Records a completed payment and confirms the registration.
 *
 * Idempotent by the UNIQUE on stripe_session_id: Stripe retries an event
 * until it is acknowledged, and the second delivery must not pay twice.
 * The insert is attempted first, and a conflict means this event has
 * already been handled — so it returns without touching the registration.
 *
 * This is the only function that sets status = 'confirmed'.
 */
export async function recordPayment(db, { reference, sessionId, paymentIntent, amountCents }) {
  const registration = await getByReference(db, reference);
  if (registration === null) {
    console.error(`Payment for unknown registration reference: ${reference}`);
    return null;
  }

  const inserted = await db.prepare(
    `INSERT INTO payments (registration_id, stripe_session_id, stripe_payment_intent, amount_cents, status)
     VALUES (?, ?, ?, ?, 'paid')
     ON CONFLICT(stripe_session_id) DO NOTHING
     RETURNING *`,
  ).bind(registration.id, sessionId, paymentIntent ?? null, amountCents).first();

  // No row means the conflict fired: this session was already recorded.
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
  if (confirmed.camper_name) {
    await db.prepare(
      `INSERT INTO campers (bib, name, created_by, consent_at, consent_by)
       VALUES (?, ?, 'registration', ?, ?)
       ON CONFLICT(bib) DO NOTHING`,
    ).bind(
      `reg-${confirmed.reference}`,
      confirmed.camper_name,
      confirmed.photo_consent === 1 ? Math.floor(Date.now() / 1000) : null,
      confirmed.photo_consent === 1 ? (confirmed.guardian_email ?? 'registration') : null,
    ).run();
  }

  return confirmed;
}
```

Note the placeholder bib `reg-<reference>`: a camper has no bib number
until the camp assigns one, and the roster requires a unique key. A
director renames it in the Face tagging tab when bibs are handed out.

- [ ] **Step 6: Declare the secrets**

In `wrangler.jsonc`, no change is needed — both are secrets, not vars.
Document them by running:

```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

Do not run these as part of implementation; they need real values.

- [ ] **Step 7: Run it and watch it pass**

```bash
npx vitest run test/worker/registration-payment.test.js
npm test
```

Expected: both pass.

- [ ] **Step 8: Commit**

```bash
git add worker/registration/ worker/routes/registration.js test/worker/registration-payment.test.js
git commit -m "feat: take a deposit through Stripe Checkout"
```

---

### Task 5: The public registration form

**Files:**
- Create: `src/pages/Register.jsx`, `src/pages/register.css`
- Modify: `src/App.jsx`, `src/components/sections/RegistrationDetails.jsx`

- [ ] **Step 1: Build the form**

Create `src/pages/Register.jsx` — four steps in one component, with the
step in React state and the draft saved on each advance. Read
`src/pages/Registration.jsx` first and match its imports and section
structure.

Key requirements, all testable in the browser pass:

- Each step saves via `PATCH /api/registration/:reference` before
  advancing, so closing the tab loses nothing.
- The reference is kept in `sessionStorage` so a reload resumes.
- The price breakdown shown comes from the API response, never computed
  in the browser — the server's number is the only one that matters.
- The photo-consent question is a checkbox that starts **unchecked**,
  with plain wording: "You may use photos of my child on the camp
  website and tag them by name."
- The final step posts to `/checkout` and follows `url`.
- If checkout returns 503, show the message and a link to `/contact`
  rather than a dead end.

- [ ] **Step 2: Route it**

In `src/App.jsx`, beside the other lazy pages:

```jsx
const Register = lazy(() => import('./pages/Register.jsx'));
// ...
<Route path="/register" element={<Register />} />
```

- [ ] **Step 3: Point the existing CTA at it**

In `src/components/sections/RegistrationDetails.jsx`, replace the
external link:

```jsx
          <Button to="/register" variant="primary" size="lg">
            Register for camp
          </Button>
```

- [ ] **Step 4: Build and commit**

```bash
npm run build
git add src/pages/Register.jsx src/pages/register.css src/App.jsx src/components/sections/RegistrationDetails.jsx
git commit -m "feat: add the four-step registration form"
```

---

### Task 6: Admin tab

**Files:**
- Create: `src/admin/pages/Registrations.jsx`
- Modify: `worker/auth/permissions.js`, `src/admin/lib/permission-areas.js`, `migrations/0011_registrations_permission.sql`, `worker/routes/registration.js`, `src/admin/AdminApp.jsx`, `src/admin/lib/api.js`

- [ ] **Step 1: Add the permission, server list first**

Add `'registrations'` to `AREAS` in `worker/auth/permissions.js`, run the
cross-check test and **watch it fail**, then add
`{ key: 'registrations', label: 'Registrations' }` to
`src/admin/lib/permission-areas.js` and
`registrations: row.can_registrations === 1` to `loadUser`.

Create `migrations/0011_registrations_permission.sql`:

```sql
-- A seventh grantable area. Its own column rather than a reuse of
-- campinfo: this is guardians' contact details and children's names, not
-- site copy.
ALTER TABLE users ADD COLUMN can_registrations INTEGER NOT NULL DEFAULT 0;
```

`worker/routes/users.js` derives its columns from AREAS, so it needs no
edit — that is the property added when `faces` was introduced.

- [ ] **Step 2: Add admin routes**

Create `worker/routes/registration-admin.js` behind
`requireArea('registrations')`: list by status, cancel, and a CSV export.
Follow `worker/routes/email.js` for shape. The CSV must reuse the
formula-injection guard from `worker/email/subscribers.js` — export
`toCsv` from there rather than writing a second one.

Mount at `/api/admin/registrations` in `worker/app.js`.

- [ ] **Step 3: Build the page and register it**

`src/admin/pages/Registrations.jsx`, using `Busy`/`Failure`/`Empty` and
`.admin-table` with `data-label` on every `<td>`.

Add to `PAGES` in `AdminApp.jsx`:

```jsx
  { id: 'registrations', label: 'Registrations', permission: 'registrations', Component: Registrations },
```

- [ ] **Step 4: Test and commit**

```bash
npm test
git add -A worker src/admin migrations
git commit -m "feat: add the registrations admin tab"
```

---

### Task 7: Full suite and browser verification

- [ ] **Step 1: Run everything**

```bash
npm test
```

- [ ] **Step 2: Apply migrations locally**

```bash
npm run migrate:local
```

- [ ] **Step 3: Verify in a browser**

Start both servers, then check `/register` at 375px and 1280px:

| What | Must be true |
|---|---|
| Four steps | Each advances, and a reload resumes where it left off |
| Price breakdown | Matches the server's quote; changing the bus updates it |
| Consent checkbox | Starts unchecked |
| Without Stripe | The final step says payment is not set up, with a contact link — not a dead end |
| Admin tab | Table stacks at 375px with labels |
| Navigation | A direct visit to `/api/registration/<ref>` renders JSON, not the SPA 404 |

- [ ] **Step 4: Read the console** — no errors, no React warnings, no
unnamed form fields.

- [ ] **Step 5: Commit any fixes**

---

## Self-Review

**Spec coverage.** Four-step flow → Task 5. Server-side pricing → Tasks 1
and 3, with three tests that a client's price is ignored. Stripe Checkout
→ Task 4. Webhook as sole writer of paid state, signature-verified and
idempotent → Task 4, four tests. Roster feed with consent → Task 4's
`recordPayment`. `registrations` permission in both AREAS lists → Task 6,
with the cross-check observed failing in between. CSV export → Task 6,
reusing the existing formula guard. No health data → nothing in the
schema, and the migration comment records why.

**Placeholders.** None in Tasks 1–4, which carry literal code. Tasks 5
and 6 describe UI against components that already exist and are
specified by requirement rather than transcribed — the patterns
(`Busy`/`Failure`/`Empty`, `data-label`, `.admin-table`) are established
in this repo and referenced by name.

**Type consistency.** `quote()` returns the same shape in the pricing
module, the API responses and the Checkout session. `reference` is the
public handle everywhere; `id` never leaves the server. Money is integer
cents in every layer, with a test asserting no floats survive.

**Known gap.** The balance is recorded, not collected — no second charge
is automated, matching the spec. `balance_due_at` and `balance_due_cents`
carry what is owed so the camp can bill it however it does today.
