import { Editable } from 'vedit';
import Button from '../ui/Button.jsx';
import Reveal from '../motion/Reveal.jsx';
import SectionHeading from '../ui/SectionHeading.jsx';
import { PACKING_LIST } from '../../data/packing.js';

/**
 * What to pack, grouped, plus what to leave at home.
 *
 * Lifted out of Camp.jsx unchanged so it can be placed, moved and removed
 * from the editor. Registered with `wrap: false` — see HomeIntro.jsx for why
 * the placement id is threaded into the nested ids.
 */
export default function CampPacking({ id = 'camp.packing', ...rest }) {
  // Derived from the placement id so two copies stay valid HTML.
  const headingId = `${id}-heading`;

  return (
    <section {...rest} className="section camp-packing" aria-labelledby={headingId}>
      <div className="container">
        <SectionHeading
          id={id}
          eyebrow="Before you go"
          title="What to pack"
          lead="There are 12 exercise sessions during the week, so bring at least 7 running outfits."
          as="h2"
        />

        <div className="packing__grid">
          {PACKING_LIST.map((group, index) => (
            <Reveal key={group.category} delay={Math.min(index, 5) * 45} className="packing__card">
              <h3 className="packing__category">{group.category}</h3>
              <ul className="packing__items">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200} className="packing__note">
          <Editable id={`${id}.leave.heading`} as="h3">Please leave at home</Editable>
          <Editable id={`${id}.leave.body`} as="p">
            XC spikes (we do not wear them for any run or workout) and packs of bottled water.
            There is no locked storage and no laundry, so if an item must be safeguarded,
            consider leaving it at home.
          </Editable>
          <Button to="/faq" variant="ghost">More in the FAQ →</Button>
        </Reveal>
      </div>
    </section>
  );
}
