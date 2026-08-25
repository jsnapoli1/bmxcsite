-- Visual editor (vedit) documents, and the permission that gates them.
--
-- `can_design` is a fifth independently grantable area alongside blog,
-- media, merch and campinfo. It is deliberately its own column rather than
-- a reuse of can_campinfo: vedit can restyle and rewrite any element on any
-- page, so it crosses every existing content area at once. Folding it into
-- campinfo would silently widen that grant to cover merch and blog pages.
--
-- DEFAULT 0 means the migration grants nobody anything. Existing admins
-- still pass, because hasPermission() short-circuits on is_admin.
ALTER TABLE users ADD COLUMN can_design INTEGER NOT NULL DEFAULT 0;

-- One row per (document key, stage). The key is the page path the editor
-- was opened on ('/', '/camp', ...); the stage is 'draft' or 'published'.
--
-- Two stages rather than one, with the public site reading only
-- 'published', is what makes the Publish button mean something: an editor
-- can save repeatedly and visitors see nothing until someone promotes the
-- draft. vedit's own staged httpAdapter expects exactly this split.
--
-- `doc` holds the vedit JSON document verbatim. This table deliberately
-- does NOT model its interior (nodes, overrides, placements): that shape is
-- vedit's to change across versions, and it ships migrateDocument() to move
-- old documents forward. Parsing it into columns here would mean every
-- library upgrade became a D1 migration.
CREATE TABLE vedit_documents (
  key        TEXT NOT NULL,
  stage      TEXT NOT NULL CHECK (stage IN ('draft', 'published')),
  doc        TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_by TEXT,
  PRIMARY KEY (key, stage)
);

-- Version history, written on every publish so a bad design change is
-- recoverable. Separate from vedit_documents because history is append-only
-- and unbounded, while the document table is exactly two rows per page.
CREATE TABLE vedit_versions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key        TEXT NOT NULL,
  doc        TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  created_by TEXT
);

-- Serves the History panel: newest version first for one page, without a
-- scan across every page's history. `id DESC` breaks ties when two versions
-- land in the same second, matching the ORDER BY in the store.
CREATE INDEX idx_vedit_versions_key_created_at
  ON vedit_versions (key, created_at DESC, id DESC);
