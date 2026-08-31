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
          <h2 className="reg-panel__title" id={headingId}>How payment works</h2>
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
  );
}
