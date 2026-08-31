import { Editable } from 'vedit';
import Button from '../ui/Button.jsx';
import Reveal from '../motion/Reveal.jsx';
import SectionHeading from '../ui/SectionHeading.jsx';
import { CAMP } from '../../data/camp.js';

/**
 * Where camp is: venue, region, and the bus origins.
 *
 * Lifted out of Home.jsx unchanged so it can be placed, moved and removed from
 * the editor. Registered with `wrap: false` — see HomeIntro.jsx for why the
 * placement id is threaded into the nested `<Editable>` ids.
 */
export default function HomeLocation({ id = 'home.location', ...rest }) {
  // Derived from the placement id so two copies of this section do not
  // emit the same HTML id — `aria-labelledby` must point at exactly one
  // element to label anything.
  const headingId = `${id}-heading`;

  return (
    <section {...rest} className="section home-location" aria-labelledby={headingId}>
      <div className="container home-location__inner">
        <SectionHeading
          id={id}
          headingId={headingId}
          eyebrow="Location"
          title="Camp Westmont, in the Pocono Mountains"
          tone="light"
          as="h2"
        />
        <Reveal delay={160} className="home-location__body">
          <Editable id={`${id}.body`} as="p">
            We run miles and miles of scenic dirt roads and trails out of an ACA-accredited
            facility in {CAMP.venue.town}. It is all-inclusive: a dining hall with healthy
            and filling meals, separate boys and girls cabins, a private lake, and a program
            of educational and fun activities.
          </Editable>
          <ul className="home-location__facts">
            <li><Editable id={`${id}.fact.venue`} as="span">Venue</Editable>{CAMP.venue.name}</li>
            <li><Editable id={`${id}.fact.region`} as="span">Region</Editable>{CAMP.venue.region}</li>
            <li><Editable id={`${id}.fact.buses-from`} as="span">Buses from</Editable>Buffalo, Rochester, Syracuse, Rockaway & Woodbridge</li>
          </ul>
          <Button id={`${id}.map-link`} href="https://maps.google.com/?q=Blue+Mountain+XC+Camp" variant="light">
            Open in Google Maps
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
