-- Albums group media into sessions or events.
--
-- An album is an organisational label, never a permission boundary: what
-- is public is decided by media.status alone (worker/media/repository.js).
-- Putting a photo in an album must not be able to publish it, and taking
-- one out must not be able to hide it.
CREATE TABLE albums (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  description TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  created_by  TEXT NOT NULL
);

-- ON DELETE SET NULL, not CASCADE. Deleting an album is an organisational
-- act; it must never delete photographs. The media row survives with no
-- album, which is the same state every row starts in.
--
-- deleteAlbum (worker/media/albums.js) also clears album_id explicitly
-- before removing the row, so the guarantee does not rest on foreign keys
-- being enforced by whatever runtime is executing this.
ALTER TABLE media ADD COLUMN album_id INTEGER
  REFERENCES albums(id) ON DELETE SET NULL;

CREATE INDEX idx_media_album ON media (album_id, uploaded_at DESC);
