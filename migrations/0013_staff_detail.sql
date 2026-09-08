-- A staff roster with enough room for what the coaches have actually done.
--
-- The page previously held a name, a role and one line of bio, so a Hall of
-- Fame induction or twenty-nine seasons at a named school had nowhere to go.
-- These columns follow how NCAA programmes present coaching staff: a list that
-- is name and title only, and a per-person page carrying the detail.
--
-- Every column here is nullable. A member with only a name still renders, and
-- `validateStaff` still requires nothing more than that.

-- The stable handle this table has never had.
--
-- `saveStaffStatements` deletes every row and re-inserts it on each save,
-- assigning ids from array position, so nothing survives an edit today. That
-- is why the admin editor keys its lists on array index (and says so), and why
-- vedit addresses a member by name — which breaks the moment a name is
-- corrected. A persisted slug is what gives a member an identity across saves,
-- and it doubles as the /staff/<slug> URL.
ALTER TABLE staff_members ADD COLUMN slug TEXT;

-- Headshot, as a reference into the media library rather than a copied URL.
-- `photo_key` is a media row's `key`; the public path is /media/<key>, which
-- only resolves once that photo is published (worker/media/repository.js).
-- Alt text is stored beside it because the media row's own alt describes the
-- photograph, while here it describes the person in context.
ALTER TABLE staff_members ADD COLUMN photo_key TEXT;
ALTER TABLE staff_members ADD COLUMN photo_alt TEXT;

-- "Clarkson University, 2006". One field, not a school/year pair: the format
-- varies (a college, a certification, sometimes both) and splitting it would
-- force a shape the data does not have.
ALTER TABLE staff_members ADD COLUMN education TEXT;

ALTER TABLE staff_members ADD COLUMN hometown TEXT;

-- Slugs address a person, so two people must not share one. A partial index,
-- because the column is nullable and pre-existing rows have no slug yet —
-- without the WHERE clause every NULL row past the first would collide.
CREATE UNIQUE INDEX idx_staff_members_slug
  ON staff_members (slug) WHERE slug IS NOT NULL;

-- Accolades hang off a member the way members hang off a group: a child table
-- with its own order, not a delimited string in a column. They are a list on
-- the page and get reordered like one.
CREATE TABLE staff_accolades (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id  INTEGER NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'draft',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_by TEXT
);

CREATE INDEX idx_staff_accolades_member ON staff_accolades (member_id, sort_order);

-- Guest speakers and staff credentials were only ever in src/data/staff.js,
-- so half the Staff page could not be edited without a deploy. They are their
-- own tables rather than a member group: a speaker is not staff, and a
-- credential describes the staff collectively rather than one person.
CREATE TABLE staff_speakers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT,
  name       TEXT NOT NULL,
  year       INTEGER,
  credential TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'draft',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_by TEXT
);

CREATE TABLE staff_credentials (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT,
  text       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'draft',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_by TEXT
);
