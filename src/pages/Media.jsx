export default function Media() {
  return (
    <div>
      <h1>Media</h1>
      <div className="media-video">
        <iframe
          width="560"
          height="315"
          src="https://www.youtube.com/embed/tgbNymZ7vqY"
          title="BMX Camp Highlights"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
      <h2>Photo Albums</h2>
      <ul>
        <li>
          <a href="https://photos.app.goo.gl/album1" target="_blank" rel="noopener noreferrer">
            2024 Camp Album
          </a>
        </li>
        <li>
          <a href="https://photos.app.goo.gl/album2" target="_blank" rel="noopener noreferrer">
            2023 Camp Album
          </a>
        </li>
        <li>
          <a href="https://photos.app.goo.gl/album3" target="_blank" rel="noopener noreferrer">
            2022 Camp Album
          </a>
        </li>
      </ul>
    </div>
  );
}
