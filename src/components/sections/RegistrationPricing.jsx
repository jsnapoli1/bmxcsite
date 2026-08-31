import { Editable } from 'vedit';
import Reveal from '../motion/Reveal.jsx';
import SectionHeading from '../ui/SectionHeading.jsx';
import { DEPOSIT, PRICE_TIERS } from '../../data/registration.js';

/**
 * Tuition tiers and the deposit.
 *
 * Lifted out of Registration.jsx unchanged so it can be placed, moved and removed
 * from the editor. Registered with `wrap: false` — see HomeIntro.jsx for why
 * the placement id is threaded into the nested ids.
 */
export default function RegistrationPricing({ id = 'registration.pricing', ...rest }) {
  // Derived from the placement id so two copies stay valid HTML.
  const headingId = `${id}-heading`;

  return (
    <section {...rest} className="section container" aria-labelledby={headingId}>
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
  );
}
