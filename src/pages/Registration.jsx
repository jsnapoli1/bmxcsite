import { Editable } from 'vedit';
import PageHeader from '../components/layout/PageHeader.jsx';
import SectionHeading from '../components/ui/SectionHeading.jsx';
import Reveal from '../components/motion/Reveal.jsx';
import Button from '../components/ui/Button.jsx';
import { CAMP } from '../data/camp.js';
import {
  PRICE_TIERS,
  BUS_ROUTES,
  DEPOSIT,
  PAYMENT_NOTES,
  FINE_PRINT,
  KEY_DATES,
} from '../data/registration.js';
import './registration.css';

export default function Registration() {
  return (
    <>
      <PageHeader
        id="registration.header"
        eyebrow={`${CAMP.session.year} session`}
        title="Registration"
        lead={`${CAMP.session.start} – ${CAMP.session.end}. Registration opens January 1st at 12:01am, and we are usually 80% full by early May.`}
      />

      {/* --- Pricing tiers --- */}
      <section className="section container" aria-labelledby="pricing-heading">
        <SectionHeading
          id="registration.tuition"
          eyebrow="Tuition"
          title="One price for everyone — teams and individuals alike"
          lead="Register earlier and pay less. There are no team discounts, because everyone gets the same low price regardless of team status."
          as="h2"
        />

        <ul className="tiers">
          {PRICE_TIERS.map((tier, index) => (
            <Reveal
              as="li"
              key={tier.name}
              delay={Math.min(index, 5) * 50}
              className={`tier${tier.highlight ? ' tier--highlight' : ''}`}
            >
              {tier.highlight ? <span className="tier__flag">Best price</span> : null}
              <h3 className="tier__name">{tier.name}</h3>
              <p className="tier__window">{tier.window}</p>
              <p className="tier__price">
                <span className="tier__currency">$</span>
                {tier.price}
              </p>
              {tier.discount ? (
                <p className="tier__save">${tier.discount} off the full rate</p>
              ) : (
                <p className="tier__save tier__save--muted">Full rate</p>
              )}
            </Reveal>
          ))}
        </ul>

        <Reveal delay={220} className="deposit">
          <div className="deposit__figure">
            <span className="deposit__amount">${DEPOSIT}</span>
            <span className="deposit__label">Non-refundable deposit</span>
          </div>
          <Editable id="registration.deposit.body" as="p" className="deposit__body">
            Your deposit guarantees your spot at BMXC. Sibling discounts take $50 off the
            2nd sibling and every sibling after that, applied at checkout.
          </Editable>
        </Reveal>
      </section>

      {/* --- Buses --- */}
      <section className="section registration-buses" aria-labelledby="buses-heading">
        <div className="container">
          <SectionHeading
            id="registration.buses"
            eyebrow="Getting there"
            title="Bus routes"
            lead="Round trip only — buses fill even faster than camp does, usually 80% full by early April."
            tone="light"
            as="h2"
          />

          <ul className="bus-routes">
            {BUS_ROUTES.map((route, index) => (
              <Reveal as="li" key={route.region} delay={Math.min(index, 5) * 50} className="bus-route">
                <div className="bus-route__body">
                  <h3 className="bus-route__region">{route.region}</h3>
                  <Editable
                    id={`registration.bus.${route.region}.stops`}
                    as="p"
                    className="bus-route__stops"
                  >
                    {route.stops}
                  </Editable>
                </div>
                <span className="bus-route__price">${route.price}</span>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* --- Payment + dates --- */}
      <section className="section container registration-details" aria-labelledby="details-heading">
        <div className="registration-details__grid">
          <Reveal className="reg-panel">
            <h2 className="reg-panel__title" id="details-heading">How payment works</h2>
            <ul className="reg-panel__list">
              {PAYMENT_NOTES.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={120} className="reg-panel">
            <h2 className="reg-panel__title">Key dates</h2>
            <ul className="key-dates">
              {KEY_DATES.map((entry) => (
                <li key={entry.label}>
                  <span className="key-dates__date">{entry.date}</span>
                  <span className="key-dates__label">{entry.label}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal delay={200} className="fine-print">
          <h2 className="fine-print__title">The fine print</h2>
          <ul className="fine-print__list">
            {FINE_PRINT.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={260} className="registration-cta">
          <Editable id="registration.cta.body" as="p">
            Registration is handled on the official camp site. Questions before you sign up?
            Email the directors — they answer everything.
          </Editable>
          <div className="registration-cta__actions">
            <Button href="https://bluemountainxccamp.com/registration.html" variant="primary" size="lg">
              Register at bluemountainxccamp.com
            </Button>
            <Button to="/contact" variant="outline" size="lg">Contact the directors</Button>
          </div>
        </Reveal>
      </section>
    </>
  );
}
