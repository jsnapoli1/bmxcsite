import { useCallback, useEffect, useRef, useState } from 'react';
import { useOptionalVeditContext, useEditable } from 'vedit';
import './carousel.css';

/**
 * A scroll-snap carousel. Native overflow scrolling does the work — touch,
 * trackpad, and keyboard all behave the way the platform expects — while the
 * arrows and dots drive it via scrollTo for pointer users.
 *
 * **The control labels are `aria-label`s, so `<Editable>` cannot reach them.**
 * The arrows render `←`/`→` marked `aria-hidden`, which makes the aria-label
 * the *only* name a screen reader gets — content, not decoration, and until
 * now the one kind of copy on this site with no handle at all. `useEditable`
 * takes a `fields` schema and hands back the props with overrides applied,
 * which is how an attribute becomes editable.
 *
 * `id` is optional: without one the hook is skipped and every existing call
 * site renders exactly as before.
 */
const CAROUSEL_DEFAULTS = Object.freeze({
  previousLabel: 'Previous',
  nextLabel: 'Next',
  slideLabel: 'Go to slide {n}',
});

const CAROUSEL_FIELDS = [
  { name: 'label', type: 'text', help: 'Names the carousel for screen readers.' },
  { name: 'previousLabel', type: 'text', help: 'Accessible name for the back arrow.' },
  { name: 'nextLabel', type: 'text', help: 'Accessible name for the forward arrow.' },
  { name: 'slideLabel', type: 'text', help: 'Each dot, with {n} for the slide number.' },
];

function CarouselView({
  children,
  label,
  previousLabel = CAROUSEL_DEFAULTS.previousLabel,
  nextLabel = CAROUSEL_DEFAULTS.nextLabel,
  slideLabel = CAROUSEL_DEFAULTS.slideLabel,
  className = '',
  veditRef = null,
  veditProps = {},
}) {
  const trackRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [bounds, setBounds] = useState({ atStart: true, atEnd: false });

  const copy = { label, previousLabel, nextLabel, slideLabel };

  const slideCount = Array.isArray(children) ? children.length : 1;

  const sync = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const { scrollLeft, scrollWidth, clientWidth } = track;
    setBounds({
      atStart: scrollLeft <= 2,
      atEnd: scrollLeft + clientWidth >= scrollWidth - 2,
    });
    const slide = track.querySelector('.carousel__slide');
    if (!slide) return;
    // Slide width plus the flex gap between slides.
    const styles = getComputedStyle(track);
    const gap = parseFloat(styles.columnGap || styles.gap) || 0;
    const step = slide.getBoundingClientRect().width + gap;
    if (step <= 0) return;
    const count = track.querySelectorAll('.carousel__slide').length;
    // The final slides share the leftover scroll distance, so a plain
    // round() never reaches the last index. Snap to it at the end.
    const atEnd = scrollLeft + clientWidth >= scrollWidth - 2;
    setActiveIndex(atEnd ? count - 1 : Math.min(Math.round(scrollLeft / step), count - 1));
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    sync();
    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    return () => {
      track.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [sync]);

  const scrollToIndex = useCallback((index) => {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.querySelector('.carousel__slide');
    if (!slide) return;
    const styles = getComputedStyle(track);
    const gap = parseFloat(styles.columnGap || styles.gap) || 0;
    const step = slide.getBoundingClientRect().width + gap;
    track.scrollTo({ left: index * step, behavior: 'smooth' });
  }, []);

  const move = useCallback(
    (direction) => scrollToIndex(Math.max(0, activeIndex + direction)),
    [activeIndex, scrollToIndex],
  );

  return (
    <div className={`carousel ${className}`.trim()} ref={veditRef} {...veditProps}>
      <div
        className="carousel__track"
        ref={trackRef}
        role="region"
        aria-label={copy.label}
        tabIndex={0}
      >
        {children}
      </div>

      <div className="carousel__controls">
        <div className="carousel__dots" role="tablist" aria-label={`${copy.label} slides`}>
          {Array.from({ length: slideCount }, (_, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-label={copy.slideLabel.replace('{n}', String(index + 1))}
              className={`carousel__dot${index === activeIndex ? ' is-active' : ''}`}
              onClick={() => scrollToIndex(index)}
            />
          ))}
        </div>

        <div className="carousel__arrows">
          <button
            type="button"
            className="carousel__arrow"
            onClick={() => move(-1)}
            disabled={bounds.atStart}
            aria-label={copy.previousLabel}
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            className="carousel__arrow"
            onClick={() => move(1)}
            disabled={bounds.atEnd}
            aria-label={copy.nextLabel}
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The registering wrapper. Rendered only when there is both an `id` and a
 * provider, so `useEditable` — which throws outside one, `disabled` or not —
 * is never reached without them.
 */
function EditableCarousel({ id, label, previousLabel, nextLabel, slideLabel, ...rest }) {
  // Resolved here, not left to CarouselView's parameter defaults: the hook
  // reports these as the node's current values, and an unresolved undefined
  // shows the inspector an empty field for a label that is plainly on screen.
  const { ref, veditProps, props } = useEditable({
    id,
    kind: 'box',
    label: 'Carousel',
    fields: CAROUSEL_FIELDS,
    props: {
      label,
      previousLabel: previousLabel ?? CAROUSEL_DEFAULTS.previousLabel,
      nextLabel: nextLabel ?? CAROUSEL_DEFAULTS.nextLabel,
      slideLabel: slideLabel ?? CAROUSEL_DEFAULTS.slideLabel,
    },
  });

  return <CarouselView {...rest} {...props} veditRef={ref} veditProps={veditProps} />;
}

/**
 * Registers with the editor only when asked to. Every call site without an
 * `id`, and any render outside a provider, goes straight to the view.
 */
export default function Carousel({ id, ...props }) {
  const hasVedit = Boolean(useOptionalVeditContext());
  if (!id || !hasVedit) return <CarouselView {...props} />;
  return <EditableCarousel id={id} {...props} />;
}
