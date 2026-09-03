-- The camp's own roster, and the consent record that gates face tagging.
--
-- Consent lives here rather than in face-service because that service's
-- roster is bib -> name with no consent concept, and because this is the
-- record a family's request has to be honoured against.
--
-- `consent_at NULL` means no consent. It is the default, so a camper added
-- in a hurry is never enrolled by accident: the absence of a decision
-- reads as "no", which is the only safe reading.
CREATE TABLE campers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  bib         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  consent_at  INTEGER,
  consent_by  TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  created_by  TEXT NOT NULL
);

CREATE INDEX idx_campers_consent ON campers (consent_at);
