import { Editable } from 'vedit';
import Reveal from '../motion/Reveal.jsx';
import SectionHeading from '../ui/SectionHeading.jsx';
import { BUS_ROUTES } from '../../data/registration.js';

/**
 * Bus routes and round-trip pricing.
 *
 * Lifted out of Registration.jsx unchanged so it can be placed, moved and removed
 * from the editor. Registered with `wrap: false` — see HomeIntro.jsx for why
 * the placement id is threaded into the nested ids.
 */
export default function RegistrationBuses({ id = 'registration.buses', ...rest }) {
  // Derived from the placement id so two copies stay valid HTML.
  const headingId = `${id}-heading`;

  return (
    <section {...rest} className="section registration-buses" aria-labelledby={headingId}>
      <div className="container">
        <SectionHeading
          id={id}
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
  );
}
