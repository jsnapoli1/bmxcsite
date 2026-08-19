import PageHeader from '../components/layout/PageHeader.jsx';
import SectionHeading from '../components/ui/SectionHeading.jsx';
import Reveal from '../components/motion/Reveal.jsx';
import Button from '../components/ui/Button.jsx';
import { MERCH, MERCH_FACTS, MERCH_ITEMS, GIVEAWAYS } from '../data/merch.js';
import './merch.css';

export default function Merch() {
  return (
    <>
      <PageHeader
        eyebrow="At camp only"
        title="BMXC Merch"
        lead="There is no online store. Merch is sold in person during camp week, cash only, first come first served — and the blue hoodie always goes fast."
      />

      {/* --- The one thing everyone needs to know --- */}
      <section className="section container" aria-labelledby="essentials-heading">
        <Reveal variant="scale" className="merch-alert">
          <span className="merch-alert__badge">Bring cash</span>
          <p className="merch-alert__body">
            We only accept cash for merch, and there is no ATM at camp. Most campers who
            buy a few items — plus snacks from the Canteen at ${MERCH.canteenPrice.min}–
            {MERCH.canteenPrice.max} each — spend around ${MERCH.typicalSpend.min}–
            {MERCH.typicalSpend.max} across the week.
          </p>
        </Reveal>

        <h2 className="sr-only" id="essentials-heading">How merch works</h2>
        <ul className="merch-facts">
          {MERCH_FACTS.map((fact, index) => (
            <Reveal as="li" key={fact.title} delay={index * 90} className="merch-fact">
              <span className="merch-fact__tag">{fact.tag}</span>
              <h3 className="merch-fact__title">{fact.title}</h3>
              <p className="merch-fact__body">{fact.body}</p>
              <span className="merch-fact__index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* --- What's usually on the table --- */}
      <section className="section merch-lineup" aria-labelledby="lineup-heading">
        <div className="container">
          <SectionHeading
            eyebrow={`Typically $${MERCH.priceRange.min}–${MERCH.priceRange.max}`}
            title="What's usually on the table"
            lead="Styles and sizes change every summer, and quantities are limited. This is the shape of it, not a guaranteed lineup."
            tone="light"
            as="h2"
          />

          <ul className="merch-lineup__grid">
            {MERCH_ITEMS.map((item, index) => (
              <Reveal
                as="li"
                key={item.name}
                delay={index * 100}
                className={`merch-item${item.hero ? ' merch-item--hero' : ''}`}
              >
                {item.hero ? <span className="merch-item__flag">Most iconic</span> : null}
                <h3 className="merch-item__name">{item.name}</h3>
                <p className="merch-item__note">{item.note}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* --- Giveaways are earned, not bought --- */}
      <section className="section container" aria-labelledby="giveaways-heading">
        <div className="merch-giveaways">
          <SectionHeading
            eyebrow="Not for sale"
            title="Hundreds of giveaways every week"
            as="h2"
            className="merch-giveaways__heading"
          />
          <Reveal delay={140} className="merch-giveaways__body">
            <p>{GIVEAWAYS.body}</p>
            <Button to="/faq" variant="ghost">More in the FAQ →</Button>
          </Reveal>
        </div>
      </section>
    </>
  );
}
