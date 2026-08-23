-- Content the camp directors edit. Every row carries its own draft/published
-- status so a half-finished edit never reaches the public site.
--
-- FK cascades are declared, but SQLite only enforces them when
-- `PRAGMA foreign_keys = ON`. D1 enables this by default; the schema test
-- asserts the cascade actually fires rather than trusting that.

CREATE TABLE staff_groups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'draft',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_by TEXT
);

CREATE TABLE staff_members (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id   INTEGER NOT NULL REFERENCES staff_groups(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  role       TEXT,
  bio        TEXT,
  since      INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'draft',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_by TEXT
);

CREATE TABLE faq_categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT,
  label      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'draft',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_by TEXT
);

CREATE TABLE faq_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES faq_categories(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'draft',
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_by  TEXT
);

CREATE TABLE merch_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  detail     TEXT,
  price_low  INTEGER,
  price_high INTEGER,
  image      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'draft',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_by TEXT
);

CREATE TABLE merch_facts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  tag        TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'draft',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_by TEXT
);

-- Only the camp fields that actually go stale year to year. The rest of the
-- CAMP object stays in code deliberately: nobody edits social links weekly,
-- and flattening the nesting would make the editor worse than the code.
CREATE TABLE camp_fields (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  label      TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'draft',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_by TEXT
);

-- Bumped on every publish. The public cache key includes this number, so a
-- publish invalidates the cache without needing an explicit KV delete to
-- succeed — a failed purge can serve stale content, a version bump cannot.
CREATE TABLE content_version (
  area    TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1
);

INSERT INTO content_version (area, version) VALUES
  ('staff', 1), ('faq', 1), ('merch', 1), ('campinfo', 1);

CREATE INDEX idx_staff_members_group ON staff_members (group_id, sort_order);
CREATE INDEX idx_faq_items_category ON faq_items (category_id, sort_order);
