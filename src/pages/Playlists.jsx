import { VeditSlot } from 'vedit';
import PageMasthead from '../components/sections/PageMasthead.jsx';
import PlaylistsSection from '../components/sections/PlaylistsSection.jsx';
import './playlists.css';

/**
 * Composed from the document rather than hardcoded. The children below are the
 * fallback vedit renders while the slot is empty — see Camp.jsx.
 *
 * The body is one component rather than several: it carries interactive state,
 * and splitting it would put that state somewhere the editor cannot reorder
 * around.
 */
export default function Playlists() {
  return (
    <VeditSlot id="playlists.page" label="Playlists page">
      <PageMasthead page="/playlists" />
      <PlaylistsSection />
    </VeditSlot>
  );
}
