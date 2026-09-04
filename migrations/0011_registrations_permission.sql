-- A seventh grantable area. Its own column rather than a reuse of
-- campinfo: this is guardians' contact details and children's names,
-- not site copy.
ALTER TABLE users ADD COLUMN can_registrations INTEGER NOT NULL DEFAULT 0;
