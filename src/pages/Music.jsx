import { spotifyEmbedUrl } from '../lib/embeds.js';

// Paste Spotify share links here (playlist, album, or track links all work).
// `title` is only used as the iframe's accessible name — the embed itself
// renders the real playlist name and artwork.
const playlists = [
  {
    title: 'BMXC Camp playlist 1',
    url: 'https://open.spotify.com/playlist/6RrjJj8qaP7Aj4S28AQ2MK',
  },
  {
    title: 'BMXC Camp playlist 2',
    url: 'https://open.spotify.com/playlist/4I8MieqHsOaN7fuqtGBBGE',
  },
  {
    title: 'BMXC Camp playlist 3',
    url: 'https://open.spotify.com/playlist/66n76i36vt3Q4KhhlLiJE2',
  },
  {
    title: 'BMXC Camp playlist 4',
    url: 'https://open.spotify.com/playlist/6fXsbSScIaUWByim5m2npc',
  },
];

export default function Music() {
  const playable = playlists.filter((item) => spotifyEmbedUrl(item.url));

  return (
    <div>
      <h1>Music</h1>
      {playable.length === 0 ? (
        <p className="empty-state">Playlists are on the way — check back soon.</p>
      ) : (
        <div className="albums">
          {playable.map((item) => (
            <iframe
              key={item.url}
              className="album-embed"
              src={spotifyEmbedUrl(item.url)}
              title={item.title}
              loading="lazy"
              allow="clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            />
          ))}
        </div>
      )}
    </div>
  );
}
