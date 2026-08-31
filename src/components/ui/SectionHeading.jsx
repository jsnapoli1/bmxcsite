import { Editable } from 'vedit';
import Reveal from '../motion/Reveal.jsx';
import SplitText from '../motion/SplitText.jsx';
import './section-heading.css';

/**
 * The shared section header: tracked eyebrow, oversized headline that reveals
 * word by word, and an optional lead paragraph.
 *
 * `id` opts this heading into the visual editor. Because every page composes
 * its sections from this component, threading one prop through here makes
 * eyebrow, title and lead editable site-wide without wrapping each of the
 * dozens of call sites individually.
 *
 * `headingId` puts a real HTML id on the rendered heading. Sections point
 * `aria-labelledby` at one, and for a long time nothing emitted it — four
 * references on the home page alone pointed at elements that did not exist,
 * so the sections were effectively unlabelled to a screen reader.
 *
 * The wrappers sit *around* SplitText, never inside it: SplitText puts each
 * word in its own span, and an override applied within that structure would
 * fight the per-word reveal (and, for the gradient-filled variants, the
 * `background-clip: text` that only reaches `.split-text__inner`).
 */
export default function SectionHeading({
  id,
  headingId,
  eyebrow,
  title,
  lead,
  align = 'start',
  tone = 'dark',
  as: Tag = 'h2',
  className = '',
}) {
  return (
    <div className={`section-heading section-heading--${align} section-heading--${tone} ${className}`}>
      {eyebrow ? (
        <Reveal variant="fade" className={`eyebrow${tone === 'light' ? ' eyebrow-light' : ''}`}>
          {id ? <Editable id={`${id}.eyebrow`} as="span">{eyebrow}</Editable> : eyebrow}
        </Reveal>
      ) : null}

      {id ? (
        <Editable id={`${id}.title`} as="div" className="section-heading__title-slot">
          <SplitText
            as={Tag}
            id={headingId}
            text={title}
            className="section-heading__title"
          />
        </Editable>
      ) : (
        <SplitText
          as={Tag}
          id={headingId}
          text={title}
          className="section-heading__title"
        />
      )}

      {lead ? (
        <Reveal delay={110} className="section-heading__lead measure">
          {id ? <Editable id={`${id}.lead`} as="p">{lead}</Editable> : <p>{lead}</p>}
        </Reveal>
      ) : null}
    </div>
  );
}
