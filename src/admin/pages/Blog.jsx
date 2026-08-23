import { useEffect, useState } from 'react';
import {
  listPosts, getPost, savePost, publishPost, deletePost, listMedia,
} from '../lib/api.js';

const EMPTY_DRAFT = {
  slug: null, title: '', excerpt: '', bodyMarkdown: '', heroMediaKey: '',
};

/**
 * Turns a title into a URL-safe slug, matching worker/content/blog.js's
 * `slugify` exactly so the preview shown while creating a post is the slug
 * the server will actually assign (server-side collision suffixing, e.g.
 * `-2`, is the one thing this can't predict — see the help text below the
 * field).
 */
function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Blog post list and editor. A slug is a permanent public URL (see
 * worker/content/blog.js), so it is shown but never editable once a post
 * exists — the same reasoning Faq.jsx applies to its Category ID field.
 * A hero image can only be chosen from already-published media: an editor
 * cannot pick a private photo here, because worker/content/blog.js refuses
 * to publish a post whose hero image isn't public, and letting someone
 * choose one that will simply fail at publish time is a worse experience
 * than never offering it.
 */
export default function Blog() {
  const [posts, setPosts] = useState(null);
  const [publicMedia, setPublicMedia] = useState([]);
  const [editingSlug, setEditingSlug] = useState(undefined); // undefined = list view, null = new post
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [pending, setPending] = useState(() => new Set());

  function markPending(key) {
    setPending((prev) => new Set(prev).add(key));
  }

  function clearPending(key) {
    setPending((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  async function refreshList() {
    const [{ posts: list }, { media }] = await Promise.all([listPosts(), listMedia()]);
    setPosts(list);
    setPublicMedia(media.filter((item) => item.status === 'public'));
  }

  useEffect(() => { refreshList().catch((err) => setError(err.message)); }, []);

  function openNewPost() {
    setError(null);
    setStatus(null);
    setDraft({ ...EMPTY_DRAFT });
    setEditingSlug(null);
  }

  async function openPost(slug) {
    setError(null);
    setStatus(null);
    try {
      const { post } = await getPost(slug);
      setDraft({
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt ?? '',
        bodyMarkdown: post.body_markdown,
        heroMediaKey: post.hero_media_key ?? '',
        status: post.status,
      });
      setEditingSlug(slug);
    } catch (err) {
      setError(err.message);
    }
  }

  function closeEditor() {
    setDraft(null);
    setEditingSlug(undefined);
    setError(null);
    setStatus(null);
  }

  async function handleSave() {
    const key = 'save';
    if (pending.has(key)) return;
    setError(null);
    setStatus(null);
    markPending(key);
    try {
      const { post } = await savePost({
        slug: draft.slug ?? undefined,
        title: draft.title,
        excerpt: draft.excerpt || null,
        bodyMarkdown: draft.bodyMarkdown,
        heroMediaKey: draft.heroMediaKey || null,
      });
      await refreshList();
      setDraft({
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt ?? '',
        bodyMarkdown: post.body_markdown,
        heroMediaKey: post.hero_media_key ?? '',
        status: post.status,
      });
      setEditingSlug(post.slug);
      setStatus(
        post.status === 'published'
          ? 'Saved. This post is published — the public site shows this version now.'
          : 'Saved as a draft. This post is not on the public site yet.',
      );
    } catch (err) {
      setError(err.message);
    } finally {
      clearPending(key);
    }
  }

  async function handlePublish() {
    const key = 'publish';
    if (pending.has(key)) return;
    setError(null);
    setStatus(null);
    markPending(key);
    try {
      const { post } = await publishPost(draft.slug);
      await refreshList();
      setDraft({
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt ?? '',
        bodyMarkdown: post.body_markdown,
        heroMediaKey: post.hero_media_key ?? '',
        status: post.status,
      });
      setStatus('Published. The public site now shows this post.');
    } catch (err) {
      setError(err.message);
    } finally {
      clearPending(key);
    }
  }

  async function handleDelete(post) {
    const key = `delete:${post.slug}`;
    if (pending.has(key)) return;

    const consequence = post.status === 'published'
      ? 'It is currently PUBLISHED — deleting it removes it from the public site immediately, and this cannot be undone.'
      : 'This cannot be undone.';
    const confirmed = window.confirm(`Delete "${post.title}" permanently? ${consequence}`);
    if (!confirmed) return;

    setError(null);
    setStatus(null);
    markPending(key);
    try {
      await deletePost(post.slug);
      if (editingSlug === post.slug) closeEditor();
      await refreshList();
    } catch (err) {
      setError(err.message);
    } finally {
      clearPending(key);
    }
  }

  if (!posts) {
    return (
      <section className="admin-section" aria-labelledby="blog-heading">
        <h2 id="blog-heading">Blog</h2>
        {error
          ? <p className="admin-error" role="alert">{error}</p>
          : <p className="admin-notice" aria-busy="true">Loading…</p>}
      </section>
    );
  }

  if (editingSlug !== undefined && draft) {
    return (
      <BlogEditor
        draft={draft}
        setDraft={setDraft}
        isNew={editingSlug === null}
        publicMedia={publicMedia}
        error={error}
        status={status}
        pending={pending}
        onSave={handleSave}
        onPublish={handlePublish}
        onBack={closeEditor}
      />
    );
  }

  return (
    <section className="admin-section" aria-labelledby="blog-heading">
      <h2 id="blog-heading">Blog</h2>
      <p className="admin-help">
        Saving keeps a post a draft. Publishing makes it live on the public
        site at its own permanent address.
      </p>

      {error && <p className="admin-error" role="alert">{error}</p>}
      {status && <p className="admin-status" role="status">{status}</p>}

      <div className="admin-actions">
        <button type="button" className="admin-add" onClick={openNewPost}>
          Write a new post
        </button>
      </div>

      {posts.length === 0 ? (
        <p className="admin-help">No posts yet.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Status</th>
              <th scope="col"><span className="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.slug}>
                <th scope="row">
                  <button type="button" className="admin-linklike" onClick={() => openPost(post.slug)}>
                    {post.title}
                  </button>
                  <span className="admin-person-email">/blog/{post.slug}</span>
                </th>
                <td>
                  <span className={post.status === 'published' ? 'blog-status blog-status--published' : 'blog-status blog-status--draft'}>
                    {post.status === 'published' ? 'Published' : 'Draft'}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="admin-remove"
                    disabled={pending.has(`delete:${post.slug}`)}
                    aria-busy={pending.has(`delete:${post.slug}`)}
                    onClick={() => handleDelete(post)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function BlogEditor({
  draft, setDraft, isNew, publicMedia, error, status, pending, onSave, onPublish, onBack,
}) {
  const slugPreview = isNew ? slugify(draft.title) || '(will be generated from the title)' : draft.slug;
  const isPublished = draft.status === 'published';

  return (
    <section className="admin-section" aria-labelledby="blog-editor-heading">
      <div className="staff-group__header">
        <h2 id="blog-editor-heading">{isNew ? 'New post' : draft.title || '(untitled)'}</h2>
        <button type="button" className="admin-remove" onClick={onBack}>
          Back to all posts
        </button>
      </div>

      {error && <p className="admin-error" role="alert">{error}</p>}
      {status && <p className="admin-status" role="status">{status}</p>}

      {!isNew && (
        <p className="admin-draft-state">
          {isPublished
            ? 'Published. The public site shows this post.'
            : 'This is a draft. It is not on the public site yet.'}
        </p>
      )}

      <div className="admin-actions">
        <button
          type="button"
          className="admin-save"
          disabled={pending.has('save') || draft.title.trim() === '' || draft.bodyMarkdown.trim() === ''}
          aria-busy={pending.has('save')}
          onClick={onSave}
        >
          Save draft
        </button>
        <button
          type="button"
          className="admin-publish"
          disabled={isNew || pending.has('publish')}
          aria-busy={pending.has('publish')}
          onClick={onPublish}
        >
          Publish
        </button>
      </div>
      {isNew && (
        <p className="admin-help">
          Save this post first, then publish it from here once it has been saved.
        </p>
      )}

      <div className="campinfo-fields">
        <label className="admin-field">
          Title
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </label>

        <div className="admin-field admin-field--readonly">
          Web address
          <span className="admin-field__value">/blog/{slugPreview}</span>
          <span className="admin-field__hint">
            {isNew
              ? 'Generated from the title once you save. If another post already uses this address, a number is added automatically.'
              : 'Set when this post was created and cannot be changed — this is the post’s permanent public address. Changing the title will not move it.'}
          </span>
        </div>

        <label className="admin-field">
          Excerpt
          <textarea
            value={draft.excerpt}
            placeholder="A short summary shown on the blog list page. Optional."
            onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
          />
        </label>

        <label className="admin-field">
          Hero image
          <select
            value={draft.heroMediaKey}
            onChange={(e) => setDraft({ ...draft, heroMediaKey: e.target.value })}
          >
            <option value="">No hero image</option>
            {publicMedia.map((item) => (
              <option key={item.key} value={item.key}>{item.filename}</option>
            ))}
          </select>
          <span className="admin-field__hint">
            Only published photos are offered here. A post cannot be
            published with a hero image that is still private &mdash; publish
            the photo first on the Photos &amp; videos page, then come back.
          </span>
        </label>

        <label className="admin-field admin-field--wide">
          Body
          <textarea
            className="blog-body-textarea"
            value={draft.bodyMarkdown}
            placeholder="Write the post here, in plain Markdown."
            onChange={(e) => setDraft({ ...draft, bodyMarkdown: e.target.value })}
          />
          <span className="admin-field__hint">
            Plain text with Markdown formatting (like **bold** or # headings).
            No raw HTML &mdash; it will be shown as plain text, not rendered.
          </span>
        </label>
      </div>
    </section>
  );
}
