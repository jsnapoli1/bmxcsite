import { spotifyAlbumEmbedUrl } from '../lib/embeds.js';

// Paste Spotify album share links here. Title is optional — the embed shows
// the album art and name itself.
// Example: { title: 'Camp Mix 2026', url: 'https://open.spotify.com/album/...' }
const albums = [];

export default function Music() {
  const playable = albums.filter((album) => spotifyAlbumEmbedUrl(album.url));

  return (
    <div>
      <h1>Music</h1>
      {playable.length === 0 ? (
        <p className="empty-state">Playlists are on the way — check back soon.</p>
      ) : (
        <div className="albums">
          {playable.map((album) => (
            <iframe
              key={album.url}
              className="album-embed"
              src={spotifyAlbumEmbedUrl(album.url)}
              title={album.title ?? 'Spotify album'}
              loading="lazy"
              allow="clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            />
          ))}
        </div>
      )}
    </div>
  );
}
