/**
 * Spotify playlists — the camp's own year-by-year playlists.
 *
 * TO ADD A PLAYLIST: paste the Spotify share URL into `url` (Spotify →
 * ... → Share → Copy link to playlist) and add a title. The playlist id is
 * parsed out of the URL automatically; `embedId` is only needed for a
 * non-standard link.
 *
 * Set `featured: true` on one playlist to pin it open on page load.
 */
export const PLAYLISTS = [
  {
    id: 'bmxc26',
    year: '2026',
    title: 'BMXC26',
    description: 'Shuffle at your own risk ⚠️',
    url: 'https://open.spotify.com/playlist/6RrjJj8qaP7Aj4S28AQ2MK',
    featured: true,
  },
  {
    id: 'bmxc25',
    year: '2025',
    title: 'BMXC25',
    description: "Don't shuffle it.",
    url: 'https://open.spotify.com/playlist/4I8MieqHsOaN7fuqtGBBGE',
  },
  {
    id: 'bmxc24',
    year: '2024',
    title: 'BMXC24',
    description: '823 tracks deep. Built by campers, survived the whole week.',
    url: 'https://open.spotify.com/playlist/66n76i36vt3Q4KhhlLiJE2',
  },
  {
    id: 'bmxc23',
    year: '2023',
    title: 'BMXC23',
    description: 'Everything everywhere all at once — except country.',
    url: 'https://open.spotify.com/playlist/6fXsbSScIaUWByim5m2npc',
  },
];

/** Pulls the playlist id out of any standard Spotify share URL. */
export function getSpotifyEmbedId(playlist) {
  if (playlist.embedId) return playlist.embedId;
  if (!playlist.url) return null;
  const match = playlist.url.match(/playlist\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}
