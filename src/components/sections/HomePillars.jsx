import SectionHeading from '../ui/SectionHeading.jsx';

/**
 * What makes BMXC different — a bento-ish grid of pillars.
 *
 * Lifted out of Home.jsx unchanged so it can be placed, moved and removed from
 * the editor. Registered with `wrap: false` — see HomeIntro.jsx for why the
 * placement id is threaded into the nested `<Editable>` ids.
 */
export default function HomePillars({ id = 'home.pillars', children, ...rest }) {
  // Derived from the placement id so two copies of this section do not
  // emit the same HTML id — `aria-labelledby` must point at exactly one
  // element to label anything.
  const headingId = `${id}-heading`;

  return (
    <section {...rest} className="section home-pillars" aria-labelledby={headingId}>
      <div className="container">
        <SectionHeading
          id={id}
          headingId={headingId}
          eyebrow="About camp"
          title="What makes BMXC different"
          lead="Around 300 campers and about 70 teams attend each summer."
          as="h2"
        />

        {/* A container: each card is a placed component living in the
            document, so one can be added, reordered or removed from the
            editor without a deploy. `children` is what vedit renders
            the placements into. */}
        <div className="home-pillars__grid">{children}</div>
      </div>
    </section>
  );
}
