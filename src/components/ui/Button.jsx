import { Link } from 'react-router-dom';
import { Editable } from 'vedit';
import './button.css';

/**
 * One button, three surfaces. Renders as <a>, <Link>, or <button> depending on
 * what it's pointing at, so semantics stay honest.
 *
 * `id` opts the label into the visual editor. It sits on the inner span
 * rather than the button, so the editor addresses the words without
 * swallowing the element's own behaviour — a Link that became an editable
 * box would stop navigating. Without an id the label renders as before, so
 * every existing call site is unaffected.
 */
export default function Button({
  children,
  id,
  to,
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  ...rest
}) {
  const classes = `btn btn-${variant} btn-${size} ${className}`.trim();

  const inner = (
    <>
      {id ? (
        <Editable id={id} as="span" className="btn__label">{children}</Editable>
      ) : (
        <span className="btn__label">{children}</span>
      )}
      <span className="btn__sweep" aria-hidden="true" />
    </>
  );

  if (to) {
    return <Link to={to} className={classes} {...rest}>{inner}</Link>;
  }

  if (href) {
    const external = href.startsWith('http');
    return (
      <a
        href={href}
        className={classes}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        {...rest}
      >
        {inner}
      </a>
    );
  }

  return <button type="button" className={classes} {...rest}>{inner}</button>;
}
