import PageHeader from '../components/layout/PageHeader.jsx';
import SectionHeading from '../components/ui/SectionHeading.jsx';
import Reveal from '../components/motion/Reveal.jsx';
import Button from '../components/ui/Button.jsx';
import { SCHEDULE, CAMP } from '../data/camp.js';
import { PACKING_LIST } from '../data/packing.js';
import './camp.css';

export default function Camp() {
  return (
    <>
      <PageHeader
        eyebrow="A week on the mountain"
        title="What the week looks like"
        lead={`${CAMP.session.start} – ${CAMP.session.end}, ${CAMP.session.year}. Seven days at ${CAMP.venue.name} in ${CAMP.venue.town}.`}
      />

      {/* --- Schedule as a vertical track --- */}
      <section className="section container" aria-labelledby="schedule-heading">
        <SectionHeading
          eyebrow="Full day example"
          title="One day, start to finish"
          lead="Every full day follows this rhythm. Run, eat, learn, run again, and get to bed early enough that tomorrow works."
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
                <p className="schedule__body">{slot.body}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* --- Packing list --- */}
      <section className="section camp-packing" aria-labelledby="packing-heading">
        <div className="container">
          <SectionHeading
            eyebrow="Before you go"
            title="What to pack"
            lead="Twelve exercise sessions happen during the week, so bring more running kit than you think you need."
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
            <h3>Please leave at home</h3>
            <p>
              XC spikes (we don’t wear them for any run or workout), packs of bottled water,
              and anything valuable enough that losing it would ruin the week — there is no
              locked storage and no laundry.
            </p>
            <Button to="/faq" variant="ghost">More in the FAQ →</Button>
          </Reveal>
        </div>
      </section>
    </>
  );
}
