import PageHeader from '../components/layout/PageHeader.jsx';
import SectionHeading from '../components/ui/SectionHeading.jsx';
import Reveal from '../components/motion/Reveal.jsx';
import Button from '../components/ui/Button.jsx';
import Carousel from '../components/ui/Carousel.jsx';
import { useContent } from '../hooks/useContent.js';
import {
  MERCH,
  MERCH_FACTS,
  MERCH_ITEMS,
  MERCH_CAVEATS,
  INCLUDED_SHIRTS,
  GIVEAWAYS,
} from '../data/merch.js';
import './merch.css';

export default function Merch() {
  const { content } = useContent('merch', { items: MERCH_ITEMS, facts: MERCH_FACTS });

  return (
    <>
      <PageHeader
        eyebrow="BMXC merchandise"
        title="Apparel"
        lead="Show your BMXC pride with the items below, available during the week of camp. Cash only, and availability is limited."
      />

      {/* --- The one thing everyone needs to know --- */}
      <section className="section container" aria-labelledby="essentials-heading">
        <Reveal variant="scale" className="merch-alert">
          <span className="merch-alert__badge">Cash only</span>
          <p className="merch-alert__body">
            There is no ATM at camp, so bring cash if you plan to buy anything. Canteen
            snacks are ${MERCH.canteenPrice.min}-{MERCH.canteenPrice.max} each, and most
            campers spend about ${MERCH.typicalSpend.min}-{MERCH.typicalSpend.max} over
            the week on merch and snacks.
          </p>
        </Reveal>

        <h2 className="sr-only" id="essentials-heading">How merch works</h2>
        <ul className="merch-facts">
          {content.facts.map((fact, index) => (
            <Reveal as="li" key={fact.title} delay={Math.min(index, 5) * 45} className="merch-fact">
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
            eyebrow={`Items are $${MERCH.priceRange.min}-${MERCH.priceRange.max} each`}
            title="What we sell"
            lead="Offerings may vary from what is shown without notice, including styles, color, size, and price."
            tone="light"
            as="h2"
          />

          <Carousel label="BMXC apparel" className="carousel--light merch-carousel">
            {content.items.map((item) => (
              <article
                key={item.id}
                className={`carousel__slide merch-item${item.hero ? ' merch-item--hero' : ''}`}
              >
                <div className="merch-item__media">
                  <img
                    src={item.image}
                    alt={`${item.name} — ${item.color}`}
                    width="600"
                    height="600"
                    loading="lazy"
                  />
                  <span className="merch-item__flag">{item.tag}</span>
                </div>

                <div className="merch-item__body">
                  <h3 className="merch-item__name">{item.name}</h3>
                  <p className="merch-item__note">{item.note}</p>

                  <dl className="merch-item__specs">
                    <div>
                      <dt>Fit</dt>
                      <dd>{item.fit}</dd>
                    </div>
                    <div>
                      <dt>Fabric</dt>
                      <dd>{item.material}</dd>
                    </div>
                    <div>
                      <dt>Colour</dt>
                      <dd>{item.color}</dd>
                    </div>
                  </dl>
                </div>
              </article>
            ))}
          </Carousel>

          <Reveal delay={140} className="merch-lineup__disclaimer">
            <p>Please note:</p>
            <ul className="merch-caveats">
              {MERCH_CAVEATS.map((caveat) => (
                <li key={caveat}>{caveat}</li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* --- Shirts you don't pay for --- */}
      <section className="section container" aria-labelledby="included-heading">
        <SectionHeading
          eyebrow="Included with camp"
          title="T-shirts you do not buy"
          as="h2"
        />
        <ul className="included-shirts">
          {INCLUDED_SHIRTS.map((shirt, index) => (
            <Reveal
              as="li"
              key={shirt.title}
              delay={Math.min(index, 5) * 45}
              className="included-shirt"
            >
              <h3 className="included-shirt__title">{shirt.title}</h3>
              <p className="included-shirt__body">{shirt.body}</p>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* --- Giveaways are earned, not bought --- */}
      <section className="section container" aria-labelledby="giveaways-heading">
        <div className="merch-giveaways">
          <SectionHeading
            eyebrow="Prizes"
            title="Giveaways during the week"
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
