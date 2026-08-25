import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader.jsx';
import Reveal from '../components/motion/Reveal.jsx';
import NotFound from './NotFound.jsx';
import { renderMarkdown } from '../lib/markdown.js';
import './blog.css';

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long', day: 'numeric', year: 'numeric',
});

function formatPublishedAt(publishedAtSeconds) {
  return DATE_FORMATTER.format(new Date(publishedAtSeconds * 1000));
}

/**
 * A single blog post. Fetches `/api/content/blog/:slug` directly (see
 * Blog.jsx for why this doesn't go through useContent) — an unknown or
 * unpublished slug is a 404 from the API, which renders NotFound here
 * rather than crashing or showing a blank page.
 */
export default function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'not-found' | 'error'

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setPost(null);

    fetch(`/api/content/blog/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (res.status === 404) return Promise.reject(new Error('not-found'));
        if (!res.ok) return Promise.reject(new Error('error'));
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setPost(data.post);
        setStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus(error?.message === 'not-found' ? 'not-found' : 'error');
      });

    return () => { cancelled = true; };
  }, [slug]);

  if (status === 'loading') {
    return <div className="route-fallback" aria-busy="true" />;
  }

  if (status === 'not-found') {
    return <NotFound />;
  }

  if (status === 'error' || !post) {
    return (
      <>
        <PageHeader
          id="blogpost.error"
          eyebrow="Blog"
          title="Something went wrong"
          lead="The post could not be loaded. Try again in a moment."
        />
      </>
    );
  }

  // renderMarkdown disables raw HTML at the parser (html: false in
  // src/lib/markdown.js), so the string returned here can only contain
  // markup markdown-it itself generated from a fixed set of block/inline
  // rules — never a tag the post author typed directly. That is what makes
  // dangerouslySetInnerHTML safe on this specific output. Do not "simplify"
  // this to plain text rendering or reach for a different HTML source
  // without re-reading src/lib/markdown.js first.
  const bodyHtml = renderMarkdown(post.body_markdown);

  return (
    <>
      {/* Keyed per post, on the slug: the masthead is this post's own
          title and excerpt, so one shared id would let an edit on one post
          bleed onto every other. */}
      <PageHeader
        id={`blogpost.${post.slug}.header`}
        eyebrow={formatPublishedAt(post.published_at)}
        title={post.title}
        lead={post.excerpt || undefined}
      />

      <article className="section container blog-post">
        {post.hero_media_key ? (
          <Reveal className="blog-post__hero">
            <img
              src={`/media/${post.hero_media_key}`}
              alt={post.hero_media_alt || ''}
              width="1200"
              height="675"
              loading="lazy"
            />
          </Reveal>
        ) : null}

        <Reveal
          delay={80}
          className="blog-post__body measure"
          // See the comment above bodyHtml: safe only because raw HTML is
          // disabled at the markdown parser.
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </article>
    </>
  );
}
