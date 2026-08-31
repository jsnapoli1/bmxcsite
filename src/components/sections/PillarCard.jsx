import { Editable } from 'vedit';
import Reveal from '../motion/Reveal.jsx';

/**
 * One card in the pillars grid, placed from the editor.
 *
 * Its copy lives in the document rather than in `src/data`, so cards can be
 * added, reordered and removed without a deploy. That is the trade this
 * makes: the text no longer appears in a pull request, and a deleted card is
 * recovered through the History panel rather than `git revert`.
 *
 * `wide` is a field rather than derived from position. The grid's first card
 * used to be wide because it was first; making it a property means a person
 * can decide which card leads without having to reorder to get the layout.
 *
 * The `01/02` counter is deliberately not a field. It is `aria-hidden`
 * decoration numbering cards in render order, and a hand-set value could
 * disagree with the order they appear in. vedit gives a placed component no
 * sibling index either, so it comes from a CSS counter in home.css.
 */
export default function PillarCard({
  id,
  tag = 'Tag',
  title = 'A pillar',
  body = '',
  wide = false,
  ...rest
}) {
  return (
    <Reveal
      {...rest}
      className={`pillar-card pillar-card--${wide ? 'wide' : 'standard'}`}
    >
      <Editable id={`${id}.tag`} as="span" className="pillar-card__tag">{tag}</Editable>
      <Editable id={`${id}.title`} as="h3" className="pillar-card__title">{title}</Editable>
      <Editable id={`${id}.body`} as="p" className="pillar-card__body">{body}</Editable>
      {/* Empty: the number comes from a CSS counter (home.css), so it
          always matches render order. */}
      <span className="pillar-card__index" aria-hidden="true" />
    </Reveal>
  );
}
