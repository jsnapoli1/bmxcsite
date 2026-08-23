import { describe, it, expect, vi } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';
import * as jwt from '../../worker/auth/jwt.js';
import { savePost, publishPost } from '../../worker/content/blog.js';
import { storeUpload, publishMedia } from '../../worker/media/repository.js';

const anon = (m,p) => app.fetch(new Request(`https://bmxc.camp${p}`, { method:m }), env);

const JPEG = new Uint8Array([0xFF,0xD8,0xFF,0xE0, ...new Array(64).fill(0x41)]);

// publishMedia refuses a row with no alt_text — see the comment above it in
// worker/media/repository.js.
async function publishedHeroImage(altText = 'Campers crossing the finish line.') {
  const media = await storeUpload(env, {
    bytes: JPEG, filename: 'hero.jpg', contentType: 'image/jpeg', uploaderEmail: 'k@x.com',
  });
  await env.DB.prepare('UPDATE media SET alt_text = ? WHERE key = ?').bind(altText, media.key).run();
  await publishMedia(env, media.key, 'k@x.com');
  return media.key;
}

describe('blog routes cannot leak a draft', () => {
  it('a draft is absent from the public index and 404s directly', async () => {
    vi.spyOn(jwt,'verifyAccessJwt').mockRejectedValue(new jwt.AuthError('none'));
    const post = await savePost(env.DB, {
      title: 'Unreleased Camp News', bodyMarkdown: 'SECRET DRAFT BODY',
    }, 'k@x.com');

    const index = await anon('GET', '/api/content/blog');
    const indexText = await index.text();
    expect(indexText).not.toContain('Unreleased Camp News');
    expect(indexText).not.toContain('SECRET DRAFT BODY');

    const direct = await anon('GET', `/api/content/blog/${post.slug}`);
    expect(direct.status).toBe(404);
    expect(await direct.text()).not.toContain('SECRET DRAFT BODY');
  });

  it('a published post IS on the public index', async () => {
    const post = await savePost(env.DB, {
      title: 'Week One Recap', bodyMarkdown: '# Heading\n\n- bullet',
    }, 'k@x.com');
    await publishPost(env, post.slug, 'k@x.com');
    const res = await anon('GET', '/api/content/blog');
    expect(await res.text()).toContain('Week One Recap');
  });

  it('no anonymous caller reaches an admin blog verb', async () => {
    vi.spyOn(jwt,'verifyAccessJwt').mockRejectedValue(new jwt.AuthError('none'));
    const post = await savePost(env.DB, { title: 'X', bodyMarkdown: 'y' }, 'k@x.com');
    const codes = [];
    for (const [m,p] of [
      ['GET','/api/admin/blog'],
      ['POST','/api/admin/blog'],
      ['POST',`/api/admin/blog/${post.slug}/publish`],
      ['DELETE',`/api/admin/blog/${post.slug}`],
    ]) codes.push((await anon(m,p)).status);
    expect(codes.some(s => s>=200 && s<300)).toBe(false);
  });

  it('an unknown slug is 404 not 500', async () => {
    expect((await anon('GET','/api/content/blog/no-such-post')).status).toBe(404);
  });
});

/**
 * `worker/content/blog.js` reads full rows with `SELECT *`, which includes
 * `author_email` — a staff member's personal address — plus internal
 * bookkeeping columns (`id`, `status`, `created_at`, `updated_at`). Those
 * must never reach an anonymous reader. `worker/routes/blog.js` projects
 * every public response through `toPublicPost` to guarantee that; these
 * tests pin the exact field list so a future refactor that reintroduces
 * `SELECT *` verbatim on a public route is caught immediately.
 */
describe('public blog responses never carry staff or internal fields', () => {
  const DROPPED_FIELDS = ['author_email', 'id', 'status', 'created_at', 'updated_at'];

  it('the public index drops author_email, id, status, created_at, updated_at', async () => {
    const post = await savePost(env.DB, {
      title: 'Staff Notes Should Not Leak', bodyMarkdown: 'Body text.',
    }, 'ken@bmxc.camp');
    await publishPost(env, post.slug, 'ken@bmxc.camp');

    const res = await anon('GET', '/api/content/blog');
    const { posts } = await res.json();
    const found = posts.find((p) => p.slug === post.slug);
    expect(found).toBeDefined();

    for (const field of DROPPED_FIELDS) {
      expect(found).not.toHaveProperty(field);
    }
    expect(JSON.stringify(found)).not.toContain('ken@bmxc.camp');
    expect(Object.keys(found).sort()).toEqual(
      ['excerpt', 'hero_media_alt', 'hero_media_key', 'published_at', 'slug', 'title'].sort(),
    );
  });

  it('a single public post drops author_email, id, status, created_at, updated_at', async () => {
    const post = await savePost(env.DB, {
      title: 'Another Staff-Free Post', bodyMarkdown: 'Full body markdown here.',
    }, 'ken@bmxc.camp');
    await publishPost(env, post.slug, 'ken@bmxc.camp');

    const res = await anon('GET', `/api/content/blog/${post.slug}`);
    const { post: found } = await res.json();

    for (const field of DROPPED_FIELDS) {
      expect(found).not.toHaveProperty(field);
    }
    expect(JSON.stringify(found)).not.toContain('ken@bmxc.camp');
    expect(found.body_markdown).toBe('Full body markdown here.');
    expect(Object.keys(found).sort()).toEqual(
      ['body_markdown', 'excerpt', 'hero_media_alt', 'hero_media_key', 'published_at', 'slug', 'title'].sort(),
    );
  });
});

/**
 * `publishMedia` refuses to publish a photo with no alt text, but that
 * requirement is pointless if the alt text itself never reaches a reader.
 * These tests confirm the public post payload carries the hero image's
 * alt text, and that a post with no hero image doesn't break because of it.
 */
describe('public blog posts expose their hero image alt text', () => {
  it('a published post with a hero image exposes its alt text publicly', async () => {
    const heroKey = await publishedHeroImage('A camper crossing the finish line.');
    const post = await savePost(env.DB, {
      title: 'Race Day', bodyMarkdown: 'Body.', heroMediaKey: heroKey,
    }, 'k@x.com');
    await publishPost(env, post.slug, 'k@x.com');

    const indexRes = await anon('GET', '/api/content/blog');
    const { posts } = await indexRes.json();
    const foundInIndex = posts.find((p) => p.slug === post.slug);
    expect(foundInIndex.hero_media_alt).toBe('A camper crossing the finish line.');

    const singleRes = await anon('GET', `/api/content/blog/${post.slug}`);
    const { post: foundSingle } = await singleRes.json();
    expect(foundSingle.hero_media_alt).toBe('A camper crossing the finish line.');
  });

  it('a post without a hero image does not break and has no alt text', async () => {
    const post = await savePost(env.DB, { title: 'No Hero Image', bodyMarkdown: 'Body.' }, 'k@x.com');
    await publishPost(env, post.slug, 'k@x.com');

    const res = await anon('GET', `/api/content/blog/${post.slug}`);
    expect(res.status).toBe(200);
    const { post: found } = await res.json();
    expect(found.hero_media_key).toBeNull();
    expect(found.hero_media_alt).toBeNull();
  });
});
