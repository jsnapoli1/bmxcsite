import { Editable } from 'vedit';
import Reveal from '../motion/Reveal.jsx';
import SectionHeading from '../ui/SectionHeading.jsx';
import { DEPOSIT, PRICE_TIERS, INSURANCE } from '../../data/registration.js';

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
            {/* Keyed on the tier's name, never its index: PRICE_TIERS is
                ordered by date, and inserting a tier must not slide one
                window's override onto another's card. */}
            {tier.highlight ? (
              <Editable id={`registration.tier.${tier.name}.flag`} as="span" className="tier__flag">
                Best price
              </Editable>
            ) : null}
            <Editable id={`registration.tier.${tier.name}.name`} as="h3" className="tier__name">
              {tier.name}
            </Editable>
            <Editable id={`registration.tier.${tier.name}.window`} as="p" className="tier__window">
              {tier.window}
            </Editable>
            {/* The price is left alone. It is what pricing.js charges, and a
                figure someone could retype here would be a second, disagreeing
                answer — the one thing this page must not have. */}
            <p className="tier__price">
              <span className="tier__currency">$</span>
              {tier.price}
            </p>
            {tier.discount ? (
              <Editable
                id={`registration.tier.${tier.name}.save`}
                as="p"
                className="tier__save"
                vars={{ discount: `$${tier.discount}` }}
              >
                {'{discount} off the full rate'}
              </Editable>
            ) : (
              <Editable
                id={`registration.tier.${tier.name}.save`}
                as="p"
                className="tier__save tier__save--muted"
              >
                Full rate
              </Editable>
            )}
          </Reveal>
        ))}
      </ul>

      <Reveal delay={220} className="deposit">
        {/* The figure and its caption are separate handles. The amount is a
            template so `{deposit}` keeps following src/data/registration.js —
            a rewrite here must not be able to advertise a deposit the
            registration form would then charge differently. */}
        <div className="deposit__figure">
          <Editable
            id="registration.deposit.amount"
            as="span"
            className="deposit__amount"
            vars={{ deposit: `$${DEPOSIT}` }}
          >
            {'{deposit}'}
          </Editable>
          <Editable id="registration.deposit.label" as="span" className="deposit__label">
            Deposit
          </Editable>
        </div>
        {/* A template, not a sentence with the price baked in. Someone rewording
            this in the editor keeps `{insurance}`, and the number stays whatever
            src/data/registration.js says — change INSURANCE and this paragraph
            follows, including any rewrite saved on top of it. */}
        <Editable
          id="registration.deposit.body"
          as="p"
          className="deposit__body"
          vars={{ insurance: `$${INSURANCE}` }}
        >
          {'Your deposit guarantees your spot at BMXC. It is non-refundable unless you add ' +
            'cancellation cover for {insurance}, which makes every camp fee refundable up ' +
            'to the first day of camp. Sibling discounts take $50 off the 2nd sibling and ' +
            'every sibling after that, applied at checkout.'}
        </Editable>
      </Reveal>
    </section>
  );
}
