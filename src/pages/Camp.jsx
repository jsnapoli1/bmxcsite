import { VeditSlot } from 'vedit';
import CampSchedule from '../components/sections/CampSchedule.jsx';
import CampPacking from '../components/sections/CampPacking.jsx';
import PageMasthead from '../components/sections/PageMasthead.jsx';
import './camp.css';

/**
 * Composed from the document rather than hardcoded: everything on this page is
 * a placed component, so it can be reordered, removed or added to from the
 * editor without a deploy.
 *
 * The children below are the *fallback* — what a visitor sees before anyone has
 * composed anything, and what the seed script (scripts/seed-vedit-pages.mjs)
 * mirrors into the document so the page starts out identical to how it always
 * looked. Once the document has placements, they replace this entirely.
 *
 * Keeping the fallback in code matters: a page whose document fails to load,
 * or has not been seeded, still renders the real page rather than an empty
 * shell.
 */
export default function Camp() {
  return (
    <VeditSlot id="camp.page" label="Camp page">
      <PageMasthead page="/camp" />
      <CampSchedule />
      <CampPacking />
    </VeditSlot>
  );
}
