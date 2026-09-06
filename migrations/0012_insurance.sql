-- Optional cancellation cover, $50.
--
-- Buying it makes every camp fee refundable in full — deposit and bus
-- included — up to the first day of camp. Without it the ordinary policy
-- applies: the deposit is non-refundable, and nothing is returned from
-- July 1. See FINE_PRINT in src/data/registration.js.
--
-- Default 0, like photo_consent: an absent decision is a decline, and
-- nobody is charged for cover they did not ask for.
ALTER TABLE registrations ADD COLUMN insurance INTEGER NOT NULL DEFAULT 0;

-- What the cover cost on this registration, recorded alongside the other
-- line items so a receipt can be reconstructed from the row.
ALTER TABLE registrations ADD COLUMN insurance_cents INTEGER;
