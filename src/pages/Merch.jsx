import { Editable, EditableImage } from 'vedit';
import MerchStore from '../components/sections/MerchStore.jsx';
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
        id="merch.header"
        eyebrow="BMXC merchandise"
        title="Apparel"
        lead="Show your BMXC pride with the items below, available during the week of camp. Cash only, and availability is limited."
      />

      {/* Renders only when the store has products. */}
      <MerchStore />

      {/* --- The one thing everyone needs to know --- */}
      <section className="section container" aria-labelledby="essentials-heading">
        <Reveal variant="scale" className="merch-alert">
          <Editable id="merch.alert.badge" as="span" className="merch-alert__badge">
            Cash only
          </Editable>
          {/* The four figures stay live as vars, so a reworded warning keeps
              quoting what the canteen actually charges. */}
          <Editable
            id="merch.alert.body"
            as="p"
            className="merch-alert__body"
            vars={{
              canteenMin: String(MERCH.canteenPrice.min),
              canteenMax: String(MERCH.canteenPrice.max),
              spendMin: String(MERCH.typicalSpend.min),
              spendMax: String(MERCH.typicalSpend.max),
            }}
          >
            {'There is no ATM at camp, so bring cash if you plan to buy anything. Canteen snacks are ${canteenMin}-{canteenMax} each, and most campers spend about ${spendMin}-{spendMax} over the week on merch and snacks.'}
          </Editable>
        </Reveal>

        <h2 className="sr-only" id="essentials-heading">
          <Editable id="merch.sr.essentials" as="span">How merch works</Editable>
        </h2>
        <ul className="merch-facts">
          {content.facts.map((fact, index) => (
            <Reveal as="li" key={fact.title} delay={Math.min(index, 5) * 45} className="merch-fact">
              {/* Keyed on fact.title, already this list's React key. */}
              <Editable
                id={`merch.fact.${fact.title}.tag`}
                as="span"
                className="merch-fact__tag"
              >
                {fact.tag}
              </Editable>
              <Editable
                id={`merch.fact.${fact.title}.title`}
                as="h3"
                className="merch-fact__title"
              >
                {fact.title}
              </Editable>
              <Editable
                id={`merch.fact.${fact.title}.body`}
                as="p"
                className="merch-fact__body"
              >
                {fact.body}
              </Editable>
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
            id="merch.catalog"
            headingId="lineup-heading"
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
                  <EditableImage
                    id={`merch.item.${item.id}.image`}
                    as="img"
                    src={item.image}
                    alt={`${item.name} — ${item.color}`}
                    width="600"
                    height="600"
                    loading="lazy"
                  />
                  <Editable
                    id={`merch.item.${item.id}.tag`}
                    as="span"
                    className="merch-item__flag"
                  >
                    {item.tag}
                  </Editable>
                </div>

                <div className="merch-item__body">
                  {/* Keyed on the database id, never the loop index: an
                      admin reordering the catalogue must not slide one
                      item's design override onto a different product.

                      Name and note come from D1 via the admin panel, so a
                      vedit override here layers on top of the CMS value and
                      wins. Edit copy in /admin; reach for the editor when
                      the *presentation* is what needs changing. */}
                  <Editable id={`merch.item.${item.id}.name`} as="h3" className="merch-item__name">
                    {item.name}
                  </Editable>
                  <Editable id={`merch.item.${item.id}.note`} as="p" className="merch-item__note">
                    {item.note}
                  </Editable>

                  <dl className="merch-item__specs">
                    <div>
                      <Editable id={`merch.item.${item.id}.fit.label`} as="dt">
                        Fit
                      </Editable>
                      <Editable id={`merch.item.${item.id}.fit`} as="dd">
                        {item.fit}
                      </Editable>
                    </div>
                    <div>
                      <Editable id={`merch.item.${item.id}.material.label`} as="dt">
                        Fabric
                      </Editable>
                      <Editable id={`merch.item.${item.id}.material`} as="dd">
                        {item.material}
                      </Editable>
                    </div>
                    <div>
                      <Editable id={`merch.item.${item.id}.color.label`} as="dt">
                        Colour
                      </Editable>
                      <Editable id={`merch.item.${item.id}.color`} as="dd">
                        {item.color}
                      </Editable>
                    </div>
                  </dl>
                </div>
              </article>
            ))}
          </Carousel>

          <Reveal delay={140} className="merch-lineup__disclaimer">
            <Editable id="merch.caveats.label" as="p">Please note:</Editable>
            <ul className="merch-caveats">
              {MERCH_CAVEATS.map((caveat) => (
                <Editable
                  key={caveat.id}
                  id={`merch.caveat.${caveat.id}`}
                  label={caveat.text}
                  as="li"
                >
                  {caveat.text}
                </Editable>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* --- Shirts you don't pay for --- */}
      <section className="section container" aria-labelledby="included-heading">
        <SectionHeading
          id="merch.included"
          headingId="included-heading"
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
              {/* Keyed on shirt.title, already this list's React key. */}
              <Editable
                id={`merch.included.${shirt.title}.title`}
                as="h3"
                className="included-shirt__title"
              >
                {shirt.title}
              </Editable>
              <Editable
                id={`merch.included.${shirt.title}.body`}
                as="p"
                className="included-shirt__body"
              >
                {shirt.body}
              </Editable>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* --- Giveaways are earned, not bought --- */}
      <section className="section container" aria-labelledby="giveaways-heading">
        <div className="merch-giveaways">
          <SectionHeading
            id="merch.giveaways"
            headingId="giveaways-heading"
            eyebrow="Prizes"
            title="Giveaways during the week"
            as="h2"
            className="merch-giveaways__heading"
          />
          <Reveal delay={140} className="merch-giveaways__body">
            <Editable id="merch.giveaways.body" as="p">{GIVEAWAYS.body}</Editable>
            <Button id="merch.cta.faq" to="/faq" variant="ghost">More in the FAQ →</Button>
          </Reveal>
        </div>
      </section>
    </>
  );
}
