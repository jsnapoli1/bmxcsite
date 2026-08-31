import { VeditSlot } from 'vedit';
import PageMasthead from '../components/sections/PageMasthead.jsx';
import RegistrationPricing from '../components/sections/RegistrationPricing.jsx';
import RegistrationBuses from '../components/sections/RegistrationBuses.jsx';
import RegistrationDetails from '../components/sections/RegistrationDetails.jsx';
import './registration.css';

/**
 * Composed from the document rather than hardcoded: everything on this page is
 * a placed component, so it can be reordered, removed or added to from the
 * editor without a deploy.
 *
 * The children below are the *fallback* — what a visitor sees before anyone
 * has composed anything, and what scripts/seed-vedit-pages.mjs mirrors into
 * the document so the page starts identical to how it always looked. vedit
 * renders them only while the slot is empty (`count === 0 ? children : null`),
 * so placements replace them entirely.
 *
 * Keeping the fallback in code matters: a page whose document fails to load,
 * or has not been seeded, still renders the real page rather than an empty
 * shell.
 */
export default function Registration() {
  return (
    <VeditSlot id="registration.page" label="Registration page">
      <PageMasthead page="/registration" />
      <RegistrationPricing />
      <RegistrationBuses />
      <RegistrationDetails />
    </VeditSlot>
  );
}
