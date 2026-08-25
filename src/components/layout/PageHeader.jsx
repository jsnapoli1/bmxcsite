import { Editable } from 'vedit';
import Reveal from '../motion/Reveal.jsx';
import SplitText from '../motion/SplitText.jsx';
import './page-header.css';

/**
 * Shared masthead for interior pages. Dark band, oversized title.
 *
 * `id` opts the masthead into the visual editor, the same way SectionHeading
 * does — one prop per page rather than a wrapper at every call site. The
 * title wrapper uses `display: contents` so SplitText's per-word reveal and
 * layout are untouched.
 */
export default function PageHeader({ id, eyebrow, title, lead }) {
  return (
    <header className="page-header">
      <div className="page-header__lanes" aria-hidden="true">
        <div className="page-header__lanes-track" />
      </div>

      <div className="container page-header__inner">
        {eyebrow ? (
          <Reveal variant="fade">
            {id ? (
              <Editable id={`${id}.eyebrow`} as="span" className="eyebrow eyebrow-light">
                {eyebrow}
              </Editable>
            ) : (
              <span className="eyebrow eyebrow-light">{eyebrow}</span>
            )}
          </Reveal>
        ) : null}

        {id ? (
          <Editable id={`${id}.title`} as="div" className="page-header__title-slot">
            <SplitText as="h1" text={title} className="page-header__title" />
          </Editable>
        ) : (
          <SplitText as="h1" text={title} className="page-header__title" />
        )}

        {lead ? (
          <Reveal delay={130} className="page-header__lead measure">
            {id ? <Editable id={`${id}.lead`} as="p">{lead}</Editable> : <p>{lead}</p>}
          </Reveal>
        ) : null}
      </div>
    </header>
  );
}
