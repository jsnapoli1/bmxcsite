import { Editable } from 'vedit';
import Button from '../ui/Button.jsx';
import Reveal from '../motion/Reveal.jsx';
import { CAMP } from '../../data/camp.js';

/**
 * Closing call to action: session dates and the two primary links.
 *
 * Lifted out of Home.jsx unchanged so it can be placed, moved and removed from
 * the editor. Registered with `wrap: false` — see HomeIntro.jsx for why the
 * placement id is threaded into the nested `<Editable>` ids.
 */
export default function HomeCta({ id = 'home.cta', ...rest }) {
  // Derived from the placement id so two copies of this section do not
  // emit the same HTML id — `aria-labelledby` must point at exactly one
  // element to label anything.
  const headingId = `${id}-heading`;

  return (
    <section {...rest} className="section container" aria-labelledby={headingId}>
      <Reveal variant="scale" className="home-cta">
        <span className="eyebrow eyebrow-accent">{CAMP.session.year} session</span>
        <h2 className="home-cta__title" id={headingId}>
          {CAMP.session.start} – {CAMP.session.end}
        </h2>
        <Editable id={`${id}.body`} as="p" className="home-cta__body">
          Registration opens January 1st at 12:01am. We are usually 80% full by early May,
          and buses fill even sooner.
        </Editable>
        <div className="home-cta__actions">
          <Button to="/registration" variant="primary" size="lg">Registration & pricing</Button>
          <Button to="/faq" variant="outline" size="lg">Read the FAQ</Button>
        </div>
      </Reveal>
    </section>
  );
}
