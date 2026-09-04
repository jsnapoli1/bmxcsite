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
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  registration_id       INTEGER NOT NULL REFERENCES registrations(id),
  stripe_session_id     TEXT NOT NULL UNIQUE,
  stripe_payment_intent TEXT,
  amount_cents          INTEGER NOT NULL,
  status                TEXT NOT NULL,
  created_at            INTEGER NOT NULL DEFAULT (unixepoch())
);
