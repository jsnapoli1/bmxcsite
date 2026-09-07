import { Editable } from 'vedit';
import Button from '../ui/Button.jsx';
import Reveal from '../motion/Reveal.jsx';
import SectionHeading from '../ui/SectionHeading.jsx';
import { CAMP } from '../../data/camp.js';

/**
 * The camp in its own words. Lifted out of Home.jsx unchanged so it can be
 * placed, moved and removed from the editor.
 *
 * Registered with `wrap: false`, so vedit renders this component directly
 * rather than inside a `<div>` it owns. Two reasons: the extra element would
 * break these full-bleed sections (`.section` carries the block padding and
 * some sections are edge-to-edge), and only the unwrapped path passes the
 * placement's `id` through as a prop.
 *
 * That `id` matters because a placed component can appear more than once. The
 * nested `<Editable>` ids are derived from it rather than hardcoded, so two
 * copies on a page get their own overrides instead of editing each other.
 * `rest` carries vedit's own props (ref, data-vedit-id) onto the root.
 */
/**
 * The section's own copy, and the registry's `defaults` for it — one constant
 * rather than two, because these must not drift apart.
 *
 * They are defaults on the parameters as well as in the registry because the
 * two render paths supply props differently. A placement goes through vedit,
 * which spreads the registry's `defaults` in; the `<VeditSlot>` fallback in
 * Home.jsx renders `<HomeIntro />` directly and spreads nothing. Living only
 * in the registry, this copy reached the first path and not the second, so
 * every render without a document — which is every local render, since the
 * editor's adapter reads /api/admin/vedit and Access answers 403 off
 * localhost — printed "undefined" as the section's heading.
 */
export const HOME_INTRO_DEFAULTS = Object.freeze({
  eyebrow: 'Since 1969',
  title: 'The oldest and longest running XC summer camp in the Northeast',
});

export default function HomeIntro({
  id = 'home.intro',
  eyebrow = HOME_INTRO_DEFAULTS.eyebrow,
  title = HOME_INTRO_DEFAULTS.title,
  ...rest
}) {
  // Derived from the placement id so two copies stay valid HTML.
  const headingId = `${id}-heading`;

  return (
    // `{...rest}` first, then className. vedit's Editable always sets a
    // className on the wrap:false path — `[className, override.className]`,
    // which is `undefined` with no override — so spreading rest *after* our
    // own className overwrites it and the section loses `.container`, and
    // with it all of its horizontal padding.
    <section {...rest} className="section container" aria-labelledby={headingId}>
      <div className="home-intro">
        <SectionHeading
          id={id}
          headingId={headingId}
          eyebrow={eyebrow}
          title={title}
          as="h2"
          className="home-intro__heading"
        />
        <Reveal delay={140} className="home-intro__body">
          <Editable id={`${id}.lead`} as="p" className="home-intro__lead">
            {CAMP.intro}
          </Editable>
          <Editable id={`${id}.reach`} as="p">{CAMP.reach}</Editable>
          <Button id={`${id}.cta`} to="/camp" variant="ghost">What a week looks like →</Button>
        </Reveal>
      </div>
    </section>
  );
}
