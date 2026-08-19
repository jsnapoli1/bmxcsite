import { useState } from 'react';
import PageHeader from '../components/layout/PageHeader.jsx';
import Reveal from '../components/motion/Reveal.jsx';
import { PLAYLISTS, getSpotifyEmbedId } from '../data/playlists.js';
import './playlists.css';

/**
 * Playlists are shown as an equaliser-style stack. Selecting one loads the
 * Spotify embed inline — iframes are only mounted for the active playlist so
 * we never pay for four third-party embeds at once.
 */
export default function Playlists() {
  const featuredIndex = Math.max(0, PLAYLISTS.findIndex((p) => p.featured));
  const [activeId, setActiveId] = useState(PLAYLISTS[featuredIndex]?.id ?? null);

  const active = PLAYLISTS.find((playlist) => playlist.id === activeId) ?? null;
  const activeEmbedId = active ? getSpotifyEmbedId(active) : null;

  return (
    <>
      <PageHeader
        eyebrow="Sound"
        title="Camp Playlists"
        lead="The soundtrack to the bus ride, the warm-up, and the last night campfire — one playlist per year, built by the campers themselves."
      />

      <section className="section container playlists" aria-labelledby="playlists-heading">
        <h2 className="sr-only" id="playlists-heading">Spotify playlists</h2>

        <div className="playlists__layout">
          {/* --- Selector --- */}
          <ul className="playlists__list">
            {PLAYLISTS.map((playlist, index) => {
              const isActive = playlist.id === activeId;
              const isReady = Boolean(getSpotifyEmbedId(playlist));

              return (
                <Reveal as="li" key={playlist.id} delay={index * 45}>
                  <button
                    type="button"
                    className={`playlist-row${isActive ? ' is-active' : ''}`}
                    onClick={() => setActiveId(playlist.id)}
                    aria-pressed={isActive}
                  >
                    {/* Equaliser bars — animated only while this row is active. */}
                    <span className="playlist-row__eq" aria-hidden="true">
                      {[0, 1, 2, 3].map((bar) => (
                        <span key={bar} className="playlist-row__bar" style={{ '--bar': bar }} />
                      ))}
                    </span>

                    <span className="playlist-row__text">
                      <span className="playlist-row__title">{playlist.title}</span>
                      <span className="playlist-row__desc">{playlist.description}</span>
                    </span>

                    <span className="playlist-row__meta">
                      <span className="playlist-row__year">{playlist.year}</span>
                      {!isReady ? <span className="playlist-row__soon">Link soon</span> : null}
                    </span>
                  </button>
                </Reveal>
              );
            })}
          </ul>

          {/* --- Player --- */}
          <Reveal variant="right" className="playlists__player">
            <div className="playlists__player-inner">
              {activeEmbedId ? (
                /* No `key` here on purpose: keying by playlist id would make
                   React tear down and remount the iframe on every switch,
                   cold-booting the whole Spotify app each time. Keeping one
                   persistent iframe and only swapping `src` lets the embed
                   stay warm, so switching is a navigation rather than a
                   full reload. */
                <iframe
                  className="playlists__embed"
                  src={`https://open.spotify.com/embed/playlist/${activeEmbedId}?theme=0`}
                  title={`${active.title} on Spotify`}
                  height="420"
                  frameBorder="0"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                />
              ) : (
                <div className="playlists__empty">
                  <span className="playlists__empty-eq" aria-hidden="true">
                    {[0, 1, 2, 3, 4].map((bar) => (
                      <span key={bar} style={{ '--bar': bar }} />
                    ))}
                  </span>
                  <p className="playlists__empty-title">
                    {active ? active.title : 'Nothing selected'}
                  </p>
                  <p className="playlists__empty-body">
                    Add this playlist’s Spotify share link to <code>src/data/playlists.js</code> and
                    the player will appear here automatically.
                  </p>
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
