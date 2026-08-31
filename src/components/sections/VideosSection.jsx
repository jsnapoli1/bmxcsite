import { useState } from 'react';
import Reveal from '../motion/Reveal.jsx';
import Button from '../ui/Button.jsx';
import { CHANNEL, VIDEOS, VIDEO_YEARS, getYouTubeId } from '../../data/videos.js';
import '../../pages/videos.css';

/**
 * The videos page body, lifted out of Videos.jsx so it can be placed
 * from the editor.
 *
 * Kept whole rather than split into sections: this carries real interactive
 * state — the year filter drives which videos render — and splitting it would mean
 * lifting that state somewhere the editor cannot reorder around.
 */
export default function VideosSection({ id, ...rest }) {
  const featuredIndex = Math.max(0, VIDEOS.findIndex((video) => video.featured));
  const [activeId, setActiveId] = useState(VIDEOS[featuredIndex]?.id ?? null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [year, setYear] = useState('All');

  const active = VIDEOS.find((video) => video.id === activeId) ?? null;
  const visible = year === 'All' ? VIDEOS : VIDEOS.filter((video) => video.year === year);
  const activeYouTubeId = active ? getYouTubeId(active) : null;

  const selectVideo = (id) => {
    setActiveId(id);
    setIsPlaying(false);
  };

  return (
    <section {...rest} className="section container videos" aria-labelledby="videos-heading">
        <h2 className="sr-only" id="videos-heading">Videos from camp</h2>

        {/* --- Stage --- */}
        <Reveal variant="scale" className="video-stage">
          {activeYouTubeId && isPlaying ? (
            <iframe
              className="video-stage__frame"
              src={`https://www.youtube-nocookie.com/embed/${activeYouTubeId}?autoplay=1&rel=0`}
              title={active.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="video-stage__poster">
              {activeYouTubeId ? (
                <>
                  <img
                    className="video-stage__thumb"
                    src={`https://i.ytimg.com/vi/${activeYouTubeId}/maxresdefault.jpg`}
                    alt=""
                    width="1280"
                    height="720"
                    loading="eager"
                  />
                  <button
                    type="button"
                    className="video-stage__play"
                    onClick={() => setIsPlaying(true)}
                  >
                    <span className="video-stage__play-icon" aria-hidden="true" />
                    <span className="sr-only">Play {active.title}</span>
                  </button>
                </>
              ) : (
                <div className="video-stage__empty">
                  <span className="video-stage__empty-mark" aria-hidden="true" />
                  <p className="video-stage__empty-title">
                    {active ? active.title : 'No video selected'}
                  </p>
                  <p className="video-stage__empty-body">
                    Paste a YouTube link into <code>src/data/videos.js</code> and it will play here.
                  </p>
                </div>
              )}
            </div>
          )}
        </Reveal>

        {active ? (
          <Reveal delay={120} className="video-stage__caption">
            <h3 className="video-stage__caption-title">{active.title}</h3>
            <p className="video-stage__caption-body">{active.description}</p>
          </Reveal>
        ) : null}

        {/* --- Year filter --- */}
        <Reveal delay={140} className="videos__filters">
          <span className="videos__filters-label" id="year-filter-label">Filter by year</span>
          <div className="videos__chips" role="group" aria-labelledby="year-filter-label">
            {['All', ...VIDEO_YEARS].map((option) => (
              <button
                key={option}
                type="button"
                className={`videos__chip${year === option ? ' is-active' : ''}`}
                onClick={() => setYear(option)}
                aria-pressed={year === option}
              >
                {option}
              </button>
            ))}
          </div>
        </Reveal>

        {/* --- Grid --- */}
        <ul className="videos__grid">
          {visible.map((video, index) => {
            const youTubeId = getYouTubeId(video);
            const isActive = video.id === activeId;

            return (
              <Reveal as="li" key={video.id} delay={Math.min(index, 5) * 45}>
                <button
                  type="button"
                  className={`video-card${isActive ? ' is-active' : ''}`}
                  onClick={() => selectVideo(video.id)}
                  aria-pressed={isActive}
                >
                  <span className="video-card__media">
                    {youTubeId ? (
                      <img
                        src={`https://i.ytimg.com/vi/${youTubeId}/hqdefault.jpg`}
                        alt=""
                        width="480"
                        height="360"
                        loading="lazy"
                      />
                    ) : (
                      <span className="video-card__placeholder" aria-hidden="true" />
                    )}
                  </span>
                  <span className="video-card__body">
                    <span className="video-card__year">{video.year}</span>
                    <span className="video-card__title">{video.title}</span>
                    <span className="video-card__desc">{video.description}</span>
                  </span>
                </button>
              </Reveal>
            );
          })}
        </ul>

        {CHANNEL.url ? (
          <Reveal delay={200} className="videos__channel">
            <Button href={CHANNEL.url} variant="outline" size="lg">
              Visit the channel on YouTube
            </Button>
          </Reveal>
        ) : (
          <Reveal delay={200} className="videos__channel videos__channel--pending">
            <p>
              Add the channel URL to <code>src/data/videos.js</code> to link the full channel here.
            </p>
          </Reveal>
        )}
    </section>
  );
}
