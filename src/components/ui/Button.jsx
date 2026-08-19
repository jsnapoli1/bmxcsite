import { Link } from 'react-router-dom';
import './button.css';

/**
 * One button, three surfaces. Renders as <a>, <Link>, or <button> depending on
 * what it's pointing at, so semantics stay honest.
 */
export default function Button({
  children,
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
      <span className="btn__label">{children}</span>
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
