/**
 * The components a page may be built from in the visual editor.
 *
 * Every entry is an ordinary React component this site already renders — the
 * schema beside it only says which props a person may change. Nothing here
 * behaves differently because it is registered.
 *
 * **`wrap: false` everywhere.** By default vedit renders a placed component
 * inside a `<div>` it owns, so it has something to select and outline. These
 * are all full-width `<section>` elements whose own class carries the block
 * padding and background, and an extra wrapper breaks that. Each component
 * spreads the props it is handed onto its own root instead, which is the
 * contract `wrap: false` asks for. It also means the placement id arrives as
 * the `id` prop — see HomeIntro.jsx for why that matters when a section is
 * placed twice.
 *
 * **Names are permanent.** Every document that places one stores the name, so
 * renaming an entry orphans existing placements: they render vedit's "not
 * registered" placeholder rather than the section. Add a new name instead.
 */
import { defineComponents } from 'vedit';

import HomeIntro from '../components/sections/HomeIntro.jsx';
import HomePillars from '../components/sections/HomePillars.jsx';
import PillarCard from '../components/sections/PillarCard.jsx';
import HomeLocation from '../components/sections/HomeLocation.jsx';
import HomeCta from '../components/sections/HomeCta.jsx';
import CampSchedule from '../components/sections/CampSchedule.jsx';
import CampPacking from '../components/sections/CampPacking.jsx';
import RegistrationPricing from '../components/sections/RegistrationPricing.jsx';
import RegistrationBuses from '../components/sections/RegistrationBuses.jsx';
import RegistrationDetails from '../components/sections/RegistrationDetails.jsx';
import ContactChannels from '../components/sections/ContactChannels.jsx';
import PlaylistsSection from '../components/sections/PlaylistsSection.jsx';
import VideosSection from '../components/sections/VideosSection.jsx';
import Hero from '../components/hero/Hero.jsx';
import PageMasthead from '../components/sections/PageMasthead.jsx';
import SectionHeading from '../components/ui/SectionHeading.jsx';

export const components = defineComponents({
  // --- Page mastheads -----------------------------------------------------
  // Both assume they are the first thing on a page. Nothing stops someone
  // placing two, but the group name and description say what they are for.
  Hero: {
    component: Hero,
    name: 'Hero',
    group: 'Mastheads',
    description: 'The full-bleed home page opener: photo, title, stat strip.',
    wrap: false,
  },

  PageMasthead: {
    component: PageMasthead,
    name: 'Page masthead',
    group: 'Mastheads',
    description: 'The dark band interior pages open with.',
    wrap: false,
    fields: [
      { name: 'eyebrow', type: 'text', help: 'Leave blank for the page default.' },
      { name: 'title', type: 'text', help: 'Leave blank for the page default.' },
      {
        name: 'lead',
        type: 'textarea',
        help: 'Leave blank for the page default, which keeps live dates current.',
      },
    ],
    // No `defaults`: the component reads its copy from src/data via `page`,
    // so an unset field renders the real text rather than a placeholder. Only
    // `page` is seeded, and it is not offered as a field — it identifies which
    // page's copy to use, not something to edit.
  },

  // --- Sections lifted from the pages -------------------------------------
  HomeIntro: {
    component: HomeIntro,
    name: 'Intro',
    group: 'Sections',
    description: 'The camp in its own words, with a link to the week.',
    wrap: false,
    fields: [
      { name: 'eyebrow', type: 'text' },
      { name: 'title', type: 'text' },
    ],
    defaults: {
      eyebrow: 'Since 1969',
      title: 'The oldest and longest running XC summer camp in the Northeast',
    },
  },

  HomePillars: {
    component: HomePillars,
    name: 'Pillars grid',
    group: 'Sections',
    description: 'What makes camp different. Holds pillar cards.',
    wrap: false,
    // Holds PillarCards, so a fifth can be added from the Insert panel.
    container: true,
  },

  PillarCard: {
    component: PillarCard,
    name: 'Pillar card',
    group: 'Cards',
    description: 'One card in the pillars grid: tag, title and a paragraph.',
    wrap: false,
    fields: [
      { name: 'tag', type: 'text', help: 'Small label above the title.' },
      { name: 'title', type: 'text' },
      { name: 'body', type: 'textarea' },
      {
        name: 'wide',
        type: 'boolean',
        help: 'Spans two columns. Usually just the first card.',
      },
    ],
    defaults: {
      tag: 'Tag',
      title: 'A pillar',
      body: 'What makes this part of camp worth knowing about.',
      wide: false,
    },
  },

  HomeLocation: {
    component: HomeLocation,
    name: 'Location',
    group: 'Sections',
    description: 'Venue, region, bus origins, and a map link.',
    wrap: false,
  },

  HomeCta: {
    component: HomeCta,
    name: 'Closing call to action',
    group: 'Sections',
    description: 'Session dates over the registration and FAQ links.',
    wrap: false,
  },

  CampSchedule: {
    component: CampSchedule,
    name: 'Daily schedule',
    group: 'Sections',
    description: 'A full day at camp, as a vertical timeline.',
    wrap: false,
  },

  CampPacking: {
    component: CampPacking,
    name: 'Packing list',
    group: 'Sections',
    description: 'What to bring, grouped, plus what to leave at home.',
    wrap: false,
  },

  RegistrationPricing: {
    component: RegistrationPricing,
    name: 'Pricing tiers',
    group: 'Sections',
    description: 'Tuition by registration window, and the deposit.',
    wrap: false,
  },

  RegistrationBuses: {
    component: RegistrationBuses,
    name: 'Bus routes',
    group: 'Sections',
    description: 'Where buses run from, and what a round trip costs.',
    wrap: false,
  },

  RegistrationDetails: {
    component: RegistrationDetails,
    name: 'Payment & dates',
    group: 'Sections',
    description: 'How to pay, the key dates, and the registration link.',
    wrap: false,
  },

  ContactChannels: {
    component: ContactChannels,
    name: 'Contact channels',
    group: 'Sections',
    description: 'Email, phone and social, plus both addresses.',
    wrap: false,
  },

  PlaylistsSection: {
    component: PlaylistsSection,
    name: 'Playlists',
    group: 'Sections',
    description: 'The playlist stack with its inline Spotify embed.',
    wrap: false,
  },

  VideosSection: {
    component: VideosSection,
    name: 'Videos',
    group: 'Sections',
    description: 'Camp recap videos, filtered by year.',
    wrap: false,
  },

  // --- Building blocks ----------------------------------------------------
  // A heading on its own, for composing a section that does not exist yet.
  SectionHeading: {
    component: SectionHeading,
    name: 'Section heading',
    group: 'Elements',
    description: 'Eyebrow, oversized title, optional lead paragraph.',
    fields: [
      { name: 'eyebrow', type: 'text' },
      { name: 'title', type: 'text' },
      { name: 'lead', type: 'textarea' },
      {
        name: 'align',
        type: 'select',
        options: ['start', 'center'],
        help: 'Centre it for a standalone section opener.',
      },
      {
        name: 'tone',
        type: 'select',
        options: ['dark', 'light'],
        help: 'Light for placing on a navy background.',
      },
    ],
    defaults: {
      eyebrow: 'Eyebrow',
      title: 'A section heading',
      lead: '',
      align: 'start',
      tone: 'dark',
    },
  },
});

export default components;
