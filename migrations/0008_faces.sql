-- `can_faces` is a sixth independently grantable area.
--
-- Its own column rather than a reuse of `media`: face tagging reads every
-- photograph and creates a durable claim that a named child appears in
-- one. Granting that through the media permission would silently widen
-- what everyone who can upload a photo is also able to do.
ALTER TABLE users ADD COLUMN can_faces INTEGER NOT NULL DEFAULT 0;
