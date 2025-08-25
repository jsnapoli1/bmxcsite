import React from 'react';

const albums = [
  {
    title: 'Random Access Memories',
    spotifyUrl: 'https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa',
    coverArt: 'https://i.scdn.co/image/ab67616d0000b273037c1b4fb37b368c9a0e4b0c',
  },
  {
    title: 'Discovery',
    spotifyUrl: 'https://open.spotify.com/album/2noRn2Aes5aoNVsU6iWThc',
    coverArt: 'https://i.scdn.co/image/ab67616d0000b27399b2f8d448c8f4d7547c5c24',
  },
];

export default function Music() {
  return (
    <div>
      <h1>Music</h1>
      <div className="albums">
        {albums.map((album) => (
          <a
            key={album.spotifyUrl}
            href={album.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src={album.coverArt} alt={`${album.title} cover`} />
            <p>{album.title}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
