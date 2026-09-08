-- Give a staff group the stable handle its members already have.
--
-- 0013 gave every member a slug so an override survives a rename. Groups were
-- left out, so `staff.group.${group.group}` keys on the title — and renaming
-- "Medical & Support" to "Medical Staff" orphans whatever was written against
-- it. Same failure the member slugs were added to prevent, one level up.
--
-- Nullable, like `staff_members.slug`: rows written before this have none,
-- and `saveStaffStatements` fills the gap from the title on the next save.
ALTER TABLE staff_groups ADD COLUMN slug TEXT;

-- A slug addresses a group, so two must not share one. Partial, because the
-- column is nullable and every pre-existing row is NULL — without the WHERE
-- clause the second such row would collide with the first.
CREATE UNIQUE INDEX idx_staff_groups_slug
  ON staff_groups (slug) WHERE slug IS NOT NULL;
