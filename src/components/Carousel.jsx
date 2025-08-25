import { useState /*, useEffect*/ } from 'react';

export default function Carousel({ images: initialImages /*, albumId*/ }) {
  const [current, setCurrent] = useState(0);
  const [images, setImages] = useState(initialImages);

  // Example code to load images from a Facebook album using the Graph API
  // useEffect(() => {
  //   async function fetchPhotos() {
  //     const res = await fetch(
  //       `https://graph.facebook.com/${albumId}/photos?fields=source&access_token=YOUR_TOKEN`
  //     );
  //     const data = await res.json();
  //     setImages(data.data.map(photo => photo.source));
  //   }
  //   fetchPhotos();
  // }, [albumId]);

  const next = () => setCurrent((current + 1) % images.length);
  const prev = () => setCurrent((current - 1 + images.length) % images.length);

  if (!images || images.length === 0) return null;

  return (
    <div className="carousel">
      {images.map((src, idx) => (
        <img
          key={src}
          src={src}
          alt={`Slide ${idx + 1}`}
          className={idx === current ? 'active' : ''}
        />
      ))}
      <button className="prev" onClick={prev}>&lt;</button>
      <button className="next" onClick={next}>&gt;</button>
    </div>
  );
}
