-- Uploaded media. Rows start private and become public only through an
-- explicit publish by someone holding the `media` permission.
--
-- This site is about children, and some camp photos show individually
-- identifiable minors. A default-private row with no publish-on-upload path
-- is the mechanism that makes an accidental exposure require a deliberate,
-- attributable action.
CREATE TABLE media (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  key          TEXT NOT NULL UNIQUE,
  filename     TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL,
  width        INTEGER,
  height       INTEGER,
  alt_text     TEXT,
  caption      TEXT,
  status       TEXT NOT NULL DEFAULT 'private',
  uploaded_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  uploaded_by  TEXT NOT NULL,
  published_at INTEGER,
  published_by TEXT
);

CREATE INDEX idx_media_status ON media (status, uploaded_at DESC);
