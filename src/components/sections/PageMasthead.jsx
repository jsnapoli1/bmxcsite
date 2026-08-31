import PageHeader from '../layout/PageHeader.jsx';
import { CAMP } from '../../data/camp.js';
import { CHANNEL } from '../../data/videos.js';

/**
 * Each composed page's masthead, with the page's own copy built in.
 *
 * The copy lives here rather than in the seeded document on purpose. Several
 * of these leads interpolate live data — session dates, venue, directors — and
 * freezing the rendered string into the document would quietly go stale the
 * day the session moves. The seed places this component by name and passes
 * only `page`; everything it says comes from `src/data/*`, exactly as before.
 *
 * `title` and `eyebrow` are still overridable from the inspector for anyone
 * who wants to retitle a page; leaving them unset renders the defaults below.
 */
const COPY = {
  '/camp': {
    eyebrow: `${CAMP.session.year} session`,
    title: 'The Week at Camp',
    lead: `${CAMP.session.start} – ${CAMP.session.end}, ${CAMP.session.year}. Seven days at ${CAMP.venue.name} in ${CAMP.venue.town}.`,
  },
  '/registration': {
    eyebrow: `${CAMP.session.year} session`,
    title: 'Registration',
    lead: `${CAMP.session.start} – ${CAMP.session.end}. Registration opens January 1st at 12:01am, and we are usually 80% full by early May.`,
  },
  '/contact': {
    eyebrow: 'Say hello',
    title: 'Contact Us',
    lead: `Questions? Email Camp Directors ${CAMP.contact.directors}, or give us a call.`,
  },
  '/playlists': {
    eyebrow: 'Sound',
    title: 'Camp Playlists',
    lead: 'A playlist for each year of camp, put together by campers.',
  },
  '/videos': {
    eyebrow: 'Watch',
    title: 'Camp Videos',
    lead: CHANNEL.description,
  },
};

export default function PageMasthead({ id, page, eyebrow, title, lead, ...rest }) {
  const copy = COPY[page] ?? {};
  return (
    <PageHeader
      {...rest}
      id={id ?? `${page}.header`}
      eyebrow={eyebrow ?? copy.eyebrow}
      title={title ?? copy.title}
      lead={lead ?? copy.lead}
    />
  );
}
