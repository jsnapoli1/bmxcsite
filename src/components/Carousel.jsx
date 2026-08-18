import { useState } from 'react';

export default function Carousel({ images = [] }) {
  const [current, setCurrent] = useState(0);

  const count = images.length;
  // Clamp rather than trust `current`: if the images prop shrinks between
  // renders the stored index can point past the end of the new array.
  const active = count > 0 ? current % count : 0;

  const next = () => setCurrent((c) => (c + 1) % count);
  const prev = () => setCurrent((c) => (c - 1 + count) % count);

  if (count === 0) return null;

  return (
    <div className="carousel">
      {images.map((src, idx) => (
        <img
          key={src}
          src={src}
          alt={`Slide ${idx + 1}`}
          className={idx === active ? 'active' : ''}
        />
      ))}
      <button className="prev" onClick={prev} aria-label="Previous slide">
        &lt;
      </button>
      <button className="next" onClick={next} aria-label="Next slide">
        &gt;
      </button>
    </div>
  );
}
