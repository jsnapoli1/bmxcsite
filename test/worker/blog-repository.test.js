import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import {
  listPosts, getPost, savePost, publishPost, deletePost, BlogError,
} from '../../worker/content/blog.js';
import { storeUpload, publishMedia } from '../../worker/media/repository.js';

const EDITOR = 'sarah@example.com';
const AUTHOR = 'ken@example.com';

// Minimal valid JPEG magic bytes, matching the pattern in
// media-repository.test.js.
function jpegBytes(length = 32) {
  const bytes = new Uint8Array(length);
  bytes.set([0xff, 0xd8, 0xff, 0xe0], 0);
  return bytes;
}

async function createPrivateMedia() {
  return storeUpload(env, {
    bytes: jpegBytes(),
    filename: 'hero.jpg',
    contentType: 'image/jpeg',
    uploaderEmail: AUTHOR,
  });
}

// publishMedia refuses a row with no alt_text — see the comment above it in
// worker/media/repository.js.
async function setAltText(key, altText = 'A photo from camp.') {
  await env.DB.prepare('UPDATE media SET alt_text = ? WHERE key = ?')
    .bind(altText, key).run();
}

async function createPublicMedia() {
  const row = await createPrivateMedia();
  await setAltText(row.key);
  return publishMedia(env, row.key, EDITOR);
}

const RECAP = {
  title: 'Camp Week Recap',
  excerpt: 'A great week at camp.',
  bodyMarkdown: '# Recap\n\nIt was a great week.',
};

describe('blog repository', () => {
  // -------------------------------------------------------------------
  // savePost — creation, updates, slug generation
  // -------------------------------------------------------------------

  it('creates a post as a draft with a slug generated from the title', async () => {
    const post = await savePost(env.DB, RECAP, AUTHOR);

    expect(post.slug).toBe('camp-week-recap');
    expect(post.status).toBe('draft');
    expect(post.published_at).toBeNull();
    expect(post.author_email).toBe(AUTHOR);
    expect(typeof post.created_at).toBe('number');
    expect(typeof post.updated_at).toBe('number');
  });

  it('stores the body as raw Markdown, not rendered HTML', async () => {
    const post = await savePost(env.DB, RECAP, AUTHOR);

    expect(post.body_markdown).toBe(RECAP.bodyMarkdown);
    // No rendering artifacts — the exact Markdown source survives the
    // round trip through the database untouched.
    expect(post.body_markdown).toContain('# Recap');
    expect(post.body_markdown).not.toContain('<h1>');
  });

  it('appends -2, -3 on slug collision rather than overwriting the existing post', async () => {
    const first = await savePost(env.DB, RECAP, AUTHOR);
    const second = await savePost(env.DB, RECAP, AUTHOR);
    const third = await savePost(env.DB, RECAP, AUTHOR);

    expect(first.slug).toBe('camp-week-recap');
    expect(second.slug).toBe('camp-week-recap-2');
    expect(third.slug).toBe('camp-week-recap-3');

    // All three must be independently retrievable — the second save must
    // never have silently overwritten the first's permanent URL.
    const gotFirst = await getPost(env.DB, 'camp-week-recap', { publishedOnly: false });
    const gotSecond = await getPost(env.DB, 'camp-week-recap-2', { publishedOnly: false });
    const gotThird = await getPost(env.DB, 'camp-week-recap-3', { publishedOnly: false });

    expect(gotFirst.id).toBe(first.id);
    expect(gotSecond.id).toBe(second.id);
    expect(gotThird.id).toBe(third.id);
  });

  it('updates an existing post in place by slug without generating a new one', async () => {
    const created = await savePost(env.DB, RECAP, AUTHOR);

    const updated = await savePost(
      env.DB,
      { ...RECAP, slug: created.slug, excerpt: 'Updated excerpt.' },
      AUTHOR,
    );

    expect(updated.id).toBe(created.id);
    expect(updated.slug).toBe(created.slug);
    expect(updated.excerpt).toBe('Updated excerpt.');

    const all = await listPosts(env.DB, { publishedOnly: false });
    expect(all).toHaveLength(1);
  });

  it('updating a post does not change its slug even if the title changes', async () => {
    const created = await savePost(env.DB, RECAP, AUTHOR);

    const updated = await savePost(
      env.DB,
      { ...RECAP, slug: created.slug, title: 'A Totally Different Title' },
      AUTHOR,
    );

    expect(updated.slug).toBe(created.slug);
    expect(updated.title).toBe('A Totally Different Title');
  });

  // -------------------------------------------------------------------
  // listPosts / getPost — draft invisibility
  // -------------------------------------------------------------------

  it('listPosts with publishedOnly excludes drafts', async () => {
    await savePost(env.DB, RECAP, AUTHOR);

    const publicList = await listPosts(env.DB, { publishedOnly: true });
    expect(publicList).toEqual([]);

    const allList = await listPosts(env.DB, { publishedOnly: false });
    expect(allList).toHaveLength(1);
  });

  it('listPosts returns newest first', async () => {
    const a = await savePost(env.DB, { ...RECAP, title: 'Post A' }, AUTHOR);
    const b = await savePost(env.DB, { ...RECAP, title: 'Post B' }, AUTHOR);
    await publishPost(env, a.slug, EDITOR);
    await publishPost(env, b.slug, EDITOR);

    const publicList = await listPosts(env.DB, { publishedOnly: true });
    expect(publicList.map((p) => p.slug)).toEqual([b.slug, a.slug]);
  });

  it('getPost with publishedOnly returns null for a draft', async () => {
    const post = await savePost(env.DB, RECAP, AUTHOR);

    const result = await getPost(env.DB, post.slug, { publishedOnly: true });
    expect(result).toBeNull();
  });

  it('getPost without publishedOnly returns a draft (editor view)', async () => {
    const post = await savePost(env.DB, RECAP, AUTHOR);

    const result = await getPost(env.DB, post.slug, { publishedOnly: false });
    expect(result.id).toBe(post.id);
  });

  it('getPost returns null for a slug that does not exist', async () => {
    const result = await getPost(env.DB, 'no-such-post', { publishedOnly: false });
    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------
  // publishPost — the private-hero-image gate
  // -------------------------------------------------------------------

  it('publishPost flips status to published and sets published_at', async () => {
    const post = await savePost(env.DB, RECAP, AUTHOR);

    const published = await publishPost(env, post.slug, EDITOR);

    expect(published.status).toBe('published');
    expect(typeof published.published_at).toBe('number');

    const visible = await getPost(env.DB, post.slug, { publishedOnly: true });
    expect(visible).not.toBeNull();
    expect(visible.status).toBe('published');
  });

  it('a draft may reference a private media key while being written', async () => {
    const media = await createPrivateMedia();

    // Saving a draft with a private hero image must succeed — the gate
    // only applies at publish time.
    const post = await savePost(
      env.DB,
      { ...RECAP, heroMediaKey: media.key },
      AUTHOR,
    );

    expect(post.hero_media_key).toBe(media.key);
    expect(post.status).toBe('draft');
  });

  it('publishing a post whose hero image is still private is refused', async () => {
    const media = await createPrivateMedia();
    const post = await savePost(
      env.DB,
      { ...RECAP, heroMediaKey: media.key },
      AUTHOR,
    );

    await expect(publishPost(env, post.slug, EDITOR)).rejects.toBeInstanceOf(BlogError);
    await expect(publishPost(env, post.slug, EDITOR)).rejects.toMatchObject({ status: 400 });

    // The post must remain a draft — a rejected publish must not have
    // partially applied.
    const stillDraft = await getPost(env.DB, post.slug, { publishedOnly: false });
    expect(stillDraft.status).toBe('draft');
    expect(stillDraft.published_at).toBeNull();

    const visible = await getPost(env.DB, post.slug, { publishedOnly: true });
    expect(visible).toBeNull();
  });

  it('publishing a post whose hero image is public succeeds', async () => {
    const media = await createPublicMedia();
    const post = await savePost(
      env.DB,
      { ...RECAP, heroMediaKey: media.key },
      AUTHOR,
    );

    const published = await publishPost(env, post.slug, EDITOR);
    expect(published.status).toBe('published');
    expect(published.hero_media_key).toBe(media.key);
  });

  it('publishing a post with no hero image at all succeeds', async () => {
    const post = await savePost(env.DB, RECAP, AUTHOR);
    expect(post.hero_media_key).toBeNull();

    const published = await publishPost(env, post.slug, EDITOR);
    expect(published.status).toBe('published');
  });

  it('publishPost throws BlogError for a slug that does not exist', async () => {
    await expect(publishPost(env, 'no-such-post', EDITOR)).rejects.toBeInstanceOf(BlogError);
    await expect(publishPost(env, 'no-such-post', EDITOR)).rejects.toMatchObject({ status: 404 });
  });

  // -------------------------------------------------------------------
  // deletePost
  // -------------------------------------------------------------------

  it('deletePost removes the post entirely', async () => {
    const post = await savePost(env.DB, RECAP, AUTHOR);
    await publishPost(env, post.slug, EDITOR);

    await deletePost(env.DB, post.slug, EDITOR);

    const result = await getPost(env.DB, post.slug, { publishedOnly: false });
    expect(result).toBeNull();
  });

  it('deletePost on a nonexistent slug does not throw', async () => {
    await expect(deletePost(env.DB, 'no-such-post', EDITOR)).resolves.not.toThrow();
  });

  // -------------------------------------------------------------------
  // malformed-input safety — a write path must never destroy content on
  // bad input (Phase 2's empty-PUT-body lesson).
  // -------------------------------------------------------------------

  it('savePost rejects a post with no title rather than silently creating an empty slug', async () => {
    await expect(
      savePost(env.DB, { ...RECAP, title: '' }, AUTHOR),
    ).rejects.toBeInstanceOf(BlogError);

    const all = await listPosts(env.DB, { publishedOnly: false });
    expect(all).toEqual([]);
  });

  it('savePost rejects a post with no body_markdown', async () => {
    await expect(
      savePost(env.DB, { title: 'Missing Body' }, AUTHOR),
    ).rejects.toBeInstanceOf(BlogError);
  });

  it('savePost updating a nonexistent slug does not silently create a mismatched row', async () => {
    // Passing a slug that isn't in the table is a malformed update
    // request, not a signal to create a fresh row under someone else's
    // intended permanent URL.
    await expect(
      savePost(env.DB, { ...RECAP, slug: 'ghost-post' }, AUTHOR),
    ).rejects.toBeInstanceOf(BlogError);

    const all = await listPosts(env.DB, { publishedOnly: false });
    expect(all).toEqual([]);
  });
});
