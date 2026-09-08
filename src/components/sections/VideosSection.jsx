import { useState } from 'react';
import { Editable } from 'vedit';
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
        <h2 className="sr-only" id="videos-heading">
          <Editable id="videos.sr.heading" as="span">Videos from camp</Editable>
        </h2>

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
                  {/* Not an EditableImage: the src is derived from the video's
                      own YouTube id, so a swappable source would let the poster
                      disagree with the video it plays. Change the video in
                      src/data/videos.js instead. */}
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
                    <Editable
                      id="videos.stage.play"
                      as="span"
                      className="sr-only"
                      vars={{ video: active.title }}
                    >
                      {'Play {video}'}
                    </Editable>
                  </button>
                </>
              ) : (
                <div className="video-stage__empty">
                  <span className="video-stage__empty-mark" aria-hidden="true" />
                  {/* A template, not a stored string: the selected video
                      changes on every click, so the override keeps the live
                      title rather than freezing one. */}
                  <Editable
                    id="videos.empty.title"
                    as="p"
                    className="video-stage__empty-title"
                    vars={{ video: active ? active.title : 'No video selected' }}
                  >
                    {'{video}'}
                  </Editable>
                  <Editable id="videos.empty.body" as="p" className="video-stage__empty-body">
                    Paste a YouTube link into <code>src/data/videos.js</code> and it will play here.
                  </Editable>
                </div>
              )}
            </div>
          )}
        </Reveal>

        {active ? (
          <Reveal delay={120} className="video-stage__caption">
            {/* Keyed on `video.id` so an override follows its video rather
                than whatever happens to be selected. */}
            <Editable
              id={`videos.item.${active.id}.title`}
              as="h3"
              className="video-stage__caption-title"
            >
              {active.title}
            </Editable>
            <Editable
              id={`videos.item.${active.id}.description`}
              as="p"
              className="video-stage__caption-body"
            >
              {active.description}
            </Editable>
          </Reveal>
        ) : null}

        {/* --- Year filter --- */}
        <Reveal delay={140} className="videos__filters">
          {/* The span keeps the DOM id `aria-labelledby` points at; the
              Editable wraps the text inside it, since one element cannot
              carry both a DOM id and a vedit node id. */}
          <span className="videos__filters-label" id="year-filter-label">
            <Editable id="videos.filters.label" as="span">
              Filter by year
            </Editable>
          </span>
          <div className="videos__chips" role="group" aria-labelledby="year-filter-label">
            {['All', ...VIDEO_YEARS].map((option) => (
              <button
                key={option}
                type="button"
                className={`videos__chip${year === option ? ' is-active' : ''}`}
                onClick={() => setYear(option)}
                aria-pressed={year === option}
              >
                {/* "All" is authored copy; the years are derived from the
                    catalogue, so only the first chip takes a handle. */}
                {option === 'All' ? (
                  <Editable id="videos.filters.all" as="span">All</Editable>
                ) : (
                  option
                )}
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
                      /* Derived from the video id — see the stage poster above. */
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
                    <Editable
                      id={`videos.card.${video.id}.year`}
                      as="span"
                      className="video-card__year"
                    >
                      {video.year}
                    </Editable>
                    <Editable
                      id={`videos.card.${video.id}.title`}
                      as="span"
                      className="video-card__title"
                    >
                      {video.title}
                    </Editable>
                    <Editable
                      id={`videos.card.${video.id}.desc`}
                      as="span"
                      className="video-card__desc"
                    >
                      {video.description}
                    </Editable>
                  </span>
                </button>
              </Reveal>
            );
          })}
        </ul>

        {CHANNEL.url ? (
          <Reveal delay={200} className="videos__channel">
            <Button id="videos.channel.cta" href={CHANNEL.url} variant="outline" size="lg">
              Visit the channel on YouTube
            </Button>
          </Reveal>
        ) : (
          <Reveal delay={200} className="videos__channel videos__channel--pending">
            <Editable id="videos.channel.pending" as="p">
              Add the channel URL to <code>src/data/videos.js</code> to link the full channel here.
            </Editable>
          </Reveal>
        )}
    </section>
  );
}
