import { youtubeEmbedUrl } from '../lib/embeds.js';

// Paste YouTube share links here (watch, youtu.be, or shorts links all work).
// Example: { title: '2026 Camp Highlights', url: 'https://youtu.be/...' }
const videos = [];

// Paste Google Photos (or any) album share links here.
// Example: { title: '2026 Camp Album', url: 'https://photos.app.goo.gl/...' }
const albums = [];

export default function Media() {
  const playable = videos.filter((video) => youtubeEmbedUrl(video.url));

  return (
    <div>
      <h1>Media</h1>

      <h2>Videos</h2>
      {playable.length === 0 ? (
        <p className="empty-state">Camp videos are on the way — check back soon.</p>
      ) : (
        playable.map((video) => (
          <div className="media-video" key={video.url}>
            <iframe
              src={youtubeEmbedUrl(video.url)}
              title={video.title ?? 'Camp video'}
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ))
      )}

      <h2>Photo Albums</h2>
      {albums.length === 0 ? (
        <p className="empty-state">Photo albums are on the way — check back soon.</p>
      ) : (
        <ul>
          {albums.map((album) => (
            <li key={album.url}>
              <a href={album.url} target="_blank" rel="noopener noreferrer">
                {album.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
