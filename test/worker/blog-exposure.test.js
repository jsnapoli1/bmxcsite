import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { savePost, publishPost, getPost, listPosts } from '../../worker/content/blog.js';
import { storeUpload, publishMedia } from '../../worker/media/repository.js';

const JPEG = new Uint8Array([0xFF,0xD8,0xFF,0xE0, ...new Array(64).fill(0x41)]);
const upload = () => storeUpload(env, { bytes: JPEG, filename:'kid.jpg',
  contentType:'image/jpeg', uploaderEmail:'k@x.com' });

/**
 * The blog is a second route by which an uploaded photo could reach the
 * public: a post's hero image. Since some camp photos show identifiable
 * minors, publishing a post whose hero image is still private must fail
 * rather than quietly expose it.
 *
 * The slug tests matter for a different reason — a slug is a permanent
 * public URL, so two posts sharing a title must never overwrite one
 * another.
 */
describe('blog cannot leak a private photo', () => {
  it('publishing with a private hero image is refused and the post stays a draft', async () => {
    const media = await upload();
    const post = await savePost(env.DB, {
      title: 'Camp Week Recap', bodyMarkdown: 'Text.', heroMediaKey: media.key,
    }, 'k@x.com');
    await expect(publishPost(env, post.slug, 'k@x.com')).rejects.toMatchObject({ status: 400 });
    const after = await getPost(env.DB, post.slug, { publishedOnly: false });
    expect(after.status).toBe('draft');
    expect(after.published_at).toBeNull();
    expect(await getPost(env.DB, post.slug, { publishedOnly: true })).toBeNull();
  });

  it('publishing succeeds once the hero image is published', async () => {
    const media = await upload();
    await publishMedia(env, media.key, 'k@x.com');
    const post = await savePost(env.DB, {
      title: 'Second Recap', bodyMarkdown: 'Text.', heroMediaKey: media.key,
    }, 'k@x.com');
    const published = await publishPost(env, post.slug, 'k@x.com');
    expect(published.status).toBe('published');
  });

  it('a post with no hero image publishes fine', async () => {
    const post = await savePost(env.DB, { title: 'No Image', bodyMarkdown: 'Text.' }, 'k@x.com');
    expect((await publishPost(env, post.slug, 'k@x.com')).status).toBe('published');
  });

  it('two posts with the same title get distinct, stable slugs', async () => {
    const a = await savePost(env.DB, { title: 'Camp Week Recap', bodyMarkdown: 'A' }, 'k@x.com');
    const b = await savePost(env.DB, { title: 'Camp Week Recap', bodyMarkdown: 'B' }, 'k@x.com');
    expect(a.slug).toBe('camp-week-recap');
    expect(b.slug).toBe('camp-week-recap-2');
    // Neither overwrote the other — a slug is a permanent public URL.
    expect((await getPost(env.DB, a.slug, { publishedOnly:false })).body_markdown).toBe('A');
    expect((await getPost(env.DB, b.slug, { publishedOnly:false })).body_markdown).toBe('B');
  });

  it('drafts never appear in the published list', async () => {
    await savePost(env.DB, { title: 'Draft Only', bodyMarkdown: 'x' }, 'k@x.com');
    const published = await listPosts(env.DB, { publishedOnly: true });
    expect(published.map(p => p.title)).not.toContain('Draft Only');
  });

  it('body is stored as markdown, not pre-rendered HTML', async () => {
    const post = await savePost(env.DB, {
      title: 'Markdown Kept', bodyMarkdown: '# Heading\n\n- item',
    }, 'k@x.com');
    const row = await getPost(env.DB, post.slug, { publishedOnly: false });
    expect(row.body_markdown).toBe('# Heading\n\n- item');
    expect(row.body_markdown).not.toContain('<h1>');
  });
});
