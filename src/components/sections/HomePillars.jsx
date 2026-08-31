import { Editable } from 'vedit';
import Reveal from '../motion/Reveal.jsx';
import SectionHeading from '../ui/SectionHeading.jsx';
import { PILLARS } from '../../data/camp.js';

/**
 * What makes BMXC different — a bento-ish grid of pillars.
 *
 * Lifted out of Home.jsx unchanged so it can be placed, moved and removed from
 * the editor. Registered with `wrap: false` — see HomeIntro.jsx for why the
 * placement id is threaded into the nested `<Editable>` ids.
 */
export default function HomePillars({ id = 'home.pillars', ...rest }) {
  // Derived from the placement id so two copies of this section do not
  // emit the same HTML id — `aria-labelledby` must point at exactly one
  // element to label anything.
  const headingId = `${id}-heading`;

  return (
    <section {...rest} className="section home-pillars" aria-labelledby={headingId}>
      <div className="container">
        <SectionHeading
          id={id}
          headingId={headingId}
          eyebrow="About camp"
          title="What makes BMXC different"
          lead="Around 300 campers and about 70 teams attend each summer."
          as="h2"
        />

        <div className="home-pillars__grid">
          {PILLARS.map((pillar, index) => (
            <Reveal
              key={pillar.title}
              delay={Math.min(index, 5) * 50}
              className={`pillar-card pillar-card--${index === 0 ? 'wide' : 'standard'}`}
            >
              <span className="pillar-card__tag">{pillar.tag}</span>
              <h3 className="pillar-card__title">{pillar.title}</h3>
              <Editable id={`${id}.pillar.${pillar.title}.body`} as="p" className="pillar-card__body">
                {pillar.body}
              </Editable>
              <span className="pillar-card__index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
