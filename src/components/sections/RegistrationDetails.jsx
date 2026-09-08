import { Editable } from 'vedit';
import Button from '../ui/Button.jsx';
import Reveal from '../motion/Reveal.jsx';
import { FINE_PRINT, KEY_DATES, PAYMENT_NOTES } from '../../data/registration.js';

/**
 * Payment methods, key dates, and the registration link.
 *
 * Lifted out of Registration.jsx unchanged so it can be placed, moved and removed
 * from the editor. Registered with `wrap: false` — see HomeIntro.jsx for why
 * the placement id is threaded into the nested ids.
 */
export default function RegistrationDetails({ id = 'registration.details', ...rest }) {
  // Derived from the placement id so two copies stay valid HTML.
  const headingId = `${id}-heading`;

  return (
    <section {...rest} className="section container registration-details" aria-labelledby={headingId}>
      <div className="registration-details__grid">
        <Reveal className="reg-panel">
          {/* The <h2> keeps the DOM id, because the section's aria-labelledby
              points at it and <Editable> takes `id` for its own node id — it
              cannot carry a DOM id too. So the editable unit is the text
              inside the heading, not the heading element. */}
          <h2 className="reg-panel__title" id={headingId}>
            <Editable id="registration.payment.title" as="span">
              How payment works
            </Editable>
          </h2>
          {/* Keyed on the explicit ids in src/data/registration.js. These
              were unwrapped while their only handle was the string itself —
              an id built from the text reattaches to a different note the
              moment someone rewords one, which is exactly what editing them
              is for. With ids in the data, rewording keeps the override and
              reordering cannot move one note's edit onto another. */}
          <ul className="reg-panel__list">
            {PAYMENT_NOTES.map((note) => (
              <Editable
                key={note.id}
                id={`registration.payment.note.${note.id}`}
                label={note.text}
                as="li"
              >
                {note.text}
              </Editable>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={120} className="reg-panel">
          <Editable id="registration.dates.title" as="h2" className="reg-panel__title">
            Key dates
          </Editable>
          {/* Keyed on the entry's label, which is what React already keys on
              and what stays put when a date moves. */}
          <ul className="key-dates">
            {KEY_DATES.map((entry) => (
              <li key={entry.label}>
                <Editable
                  id={`registration.date.${entry.label}.when`}
                  as="span"
                  className="key-dates__date"
                >
                  {entry.date}
                </Editable>
                <Editable
                  id={`registration.date.${entry.label}.label`}
                  as="span"
                  className="key-dates__label"
                >
                  {entry.label}
                </Editable>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      <Reveal delay={200} className="fine-print">
        <Editable id="registration.fine-print.title" as="h2" className="fine-print__title">
          The fine print
        </Editable>
        {/* Same as the payment notes: explicit ids in the data, so an
            override follows the rule rather than its wording. These are
            refund terms, which is exactly why the id must not track the
            text — a reattached clause here is the wrong kind of surprise. */}
        <ul className="fine-print__list">
          {FINE_PRINT.map((rule) => (
            <Editable
              key={rule.id}
              id={`registration.fine-print.${rule.id}`}
              label={rule.text}
              as="li"
            >
              {rule.text}
            </Editable>
          ))}
        </ul>
      </Reveal>

      <Reveal delay={260} className="registration-cta">
        <Editable id="registration.cta.body" as="p">
          Registration is handled on the official camp site. Questions before you sign up?
          Email the directors — they answer everything.
        </Editable>
        <div className="registration-cta__actions">
          {/* `id` puts the override on Button's inner label span, so the Link
              itself keeps navigating — see Button.jsx. */}
          <Button id="registration.cta.register" to="/register" variant="primary" size="lg">
            Register for camp
          </Button>
          <Button id="registration.cta.contact" to="/contact" variant="outline" size="lg">
            Contact the directors
          </Button>
        </div>
      </Reveal>
    </section>
  );
}
