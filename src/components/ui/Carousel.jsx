import { useCallback, useEffect, useRef, useState } from 'react';
import './carousel.css';

/**
 * A scroll-snap carousel. Native overflow scrolling does the work — touch,
 * trackpad, and keyboard all behave the way the platform expects — while the
 * arrows and dots drive it via scrollTo for pointer users.
 */
export default function Carousel({ children, label, className = '' }) {
  const trackRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [bounds, setBounds] = useState({ atStart: true, atEnd: false });

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
    <div className={`carousel ${className}`.trim()}>
      <div
        className="carousel__track"
        ref={trackRef}
        role="region"
        aria-label={label}
        tabIndex={0}
      >
        {children}
      </div>

      <div className="carousel__controls">
        <div className="carousel__dots" role="tablist" aria-label={`${label} slides`}>
          {Array.from({ length: slideCount }, (_, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-label={`Go to slide ${index + 1}`}
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
            aria-label="Previous"
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            className="carousel__arrow"
            onClick={() => move(1)}
            disabled={bounds.atEnd}
            aria-label="Next"
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
