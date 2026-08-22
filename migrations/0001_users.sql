-- Admin users. Identity comes from Cloudflare Access; this table decides
-- what a verified identity is allowed to do. An email with no row here has
-- no permissions at all.
CREATE TABLE users (
  email        TEXT PRIMARY KEY,
  name         TEXT,
  can_blog     INTEGER NOT NULL DEFAULT 0,
  can_media    INTEGER NOT NULL DEFAULT 0,
  can_merch    INTEGER NOT NULL DEFAULT 0,
  can_campinfo INTEGER NOT NULL DEFAULT 0,
  is_admin     INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Who changed what. Permission and publish actions are worth being able to
-- reconstruct after the fact.
CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_email TEXT NOT NULL,
  action      TEXT NOT NULL,
  detail      TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_audit_log_created_at ON audit_log (created_at DESC);
