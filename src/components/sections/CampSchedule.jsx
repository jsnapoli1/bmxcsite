import { Editable } from 'vedit';
import Reveal from '../motion/Reveal.jsx';
import SectionHeading from '../ui/SectionHeading.jsx';
import { SCHEDULE } from '../../data/camp.js';

/**
 * A full day at camp, as a vertical timeline.
 *
 * Lifted out of Camp.jsx unchanged so it can be placed, moved and removed
 * from the editor. Registered with `wrap: false` — see HomeIntro.jsx for why
 * the placement id is threaded into the nested ids.
 */
export default function CampSchedule({ id = 'camp.schedule', ...rest }) {
  // Derived from the placement id so two copies stay valid HTML.
  const headingId = `${id}-heading`;

  return (
    <section {...rest} className="section container" aria-labelledby={headingId}>
      <SectionHeading
        id="camp.fullday"
        eyebrow="Full day example"
        title="A full day at camp"
        lead="Here is what a full day at BMXC looks like."
        as="h2"
      />

      <ol className="schedule">
        {SCHEDULE.map((slot, index) => (
          <Reveal as="li" key={slot.time + slot.title} delay={Math.min(index, 5) * 35} className="schedule__item">
            <div className="schedule__time">{slot.time}</div>
            <div className="schedule__marker" aria-hidden="true">
              <span className="schedule__dot" />
            </div>
            <div className="schedule__content">
              <h3 className="schedule__title">{slot.title}</h3>
              <Editable
                id={`camp.schedule.${slot.time}-${slot.title}.body`}
                as="p"
                className="schedule__body"
              >
                {slot.body}
              </Editable>
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
