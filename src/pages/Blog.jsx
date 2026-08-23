import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader.jsx';
import Reveal from '../components/motion/Reveal.jsx';
import './blog.css';

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long', day: 'numeric', year: 'numeric',
});

/** `published_at` is stored as Unix seconds. */
function formatPublishedAt(publishedAtSeconds) {
  return DATE_FORMATTER.format(new Date(publishedAtSeconds * 1000));
}

/**
 * The blog index. There is no bundled fallback here — unlike the other
 * content areas (see useContent.js), a blog starts with zero posts, so an
 * empty API response is not "the API is down, show the fallback" but
 * "there is nothing published yet." This fetches directly rather than via
 * useContent for that reason: an empty list is valid content, not a signal
 * to fall back to anything.
 */
export default function Blog() {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/content/blog')
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => { if (!cancelled) setPosts(Array.isArray(data.posts) ? data.posts : []); })
      .catch(() => { if (!cancelled) setHasError(true); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="From camp"
        title="Blog"
        lead="Notes, recaps, and updates from Blue Mountain XC Camp."
      />

      <section className="section container blog" aria-labelledby="blog-heading">
        <h2 className="sr-only" id="blog-heading">Blog posts</h2>

        {isLoading ? null : hasError ? (
          <p className="blog__empty">
            The blog could not be loaded. Try again in a moment.
          </p>
        ) : posts.length === 0 ? (
          <p className="blog__empty">
            Nothing posted yet. Check back soon.
          </p>
        ) : (
          <ol className="blog-list">
            {posts.map((post, index) => (
              <Reveal as="li" key={post.slug} delay={Math.min(index, 5) * 40} className="blog-list__item">
                <Link to={`/blog/${post.slug}`} className="blog-list__link">
                  <span className="blog-list__index">{String(index + 1).padStart(2, '0')}</span>
                  <div className="blog-list__body">
                    <time className="blog-list__date" dateTime={new Date(post.published_at * 1000).toISOString()}>
                      {formatPublishedAt(post.published_at)}
                    </time>
                    <h3 className="blog-list__title">{post.title}</h3>
                    {post.excerpt ? <p className="blog-list__excerpt">{post.excerpt}</p> : null}
                  </div>
                  {post.hero_media_key ? (
                    <img
                      className="blog-list__thumb"
                      src={`/media/${post.hero_media_key}`}
                      alt=""
                      width="96"
                      height="96"
                      loading="lazy"
                    />
                  ) : null}
                </Link>
              </Reveal>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
