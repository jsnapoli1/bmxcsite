-- Newsletter subscribers, collected with double opt-in.
--
-- `token` is the handle for both confirming and unsubscribing. It is
-- unguessable and rotates on every subscribe, so an old link stops
-- working once a new one is issued.
--
-- No announcement is ever sent from this application: Cloudflare Email
-- Service is transactional-only, and the one email this table triggers is
-- the confirmation, which the subscriber themselves just asked for.
CREATE TABLE subscribers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT NOT NULL UNIQUE,
  token           TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  confirmed_at    INTEGER,
  unsubscribed_at INTEGER
);

CREATE INDEX idx_subscribers_status ON subscribers (status, created_at DESC);
