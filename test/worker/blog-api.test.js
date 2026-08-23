import { describe, it, expect, vi } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';
import * as jwt from '../../worker/auth/jwt.js';
import { savePost, publishPost } from '../../worker/content/blog.js';

const anon = (m, p, b) => {
  const hasBody = b !== undefined && m !== 'GET' && m !== 'HEAD';
  return app.fetch(new Request(`https://bmxc.camp${p}`, {
    method: m,
    headers: hasBody ? { 'content-type': 'application/json' } : {},
    body: hasBody ? JSON.stringify(b) : undefined,
  }), env);
};

function asUser(email) {
  vi.spyOn(jwt, 'verifyAccessJwt').mockResolvedValue(email);
}

async function seedUser(email, permissions = {}, isAdmin = false) {
  await env.DB.prepare(
    `INSERT INTO users (email, can_blog, can_media, can_merch, can_campinfo, is_admin)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(
    email,
    permissions.blog ? 1 : 0,
    permissions.media ? 1 : 0,
    permissions.merch ? 1 : 0,
    permissions.campinfo ? 1 : 0,
    isAdmin ? 1 : 0,
  ).run();
  return email;
}

/**
 * The public blog routes are deliberately NOT behind Cloudflare Access —
 * the public site has to read posts without authenticating. That makes
 * this the load-bearing check: a draft must never be reachable from
 * /api/content/blog, regardless of what the admin list shows.
 */
describe('a draft never appears on a public blog route', () => {
  it('does not appear in the public list', async () => {
    await savePost(env.DB, { title: 'Secret Draft Post', bodyMarkdown: 'shh' }, 'k@x.com');
    const res = await anon('GET', '/api/content/blog');
    const body = await res.text();
    expect(body).not.toContain('Secret Draft Post');
  });

  it('is a 404, not the post, at its own slug', async () => {
    const post = await savePost(env.DB, { title: 'Another Draft', bodyMarkdown: 'shh' }, 'k@x.com');
    const res = await anon('GET', `/api/content/blog/${post.slug}`);
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).not.toContain('shh');
  });

  it('a published post appears at both public routes', async () => {
    const post = await savePost(env.DB, { title: 'Real News', bodyMarkdown: 'text' }, 'k@x.com');
    await publishPost(env, post.slug, 'k@x.com');

    const listRes = await anon('GET', '/api/content/blog');
    expect(listRes.status).toBe(200);
    const { posts } = await listRes.json();
    expect(posts.map((p) => p.title)).toContain('Real News');

    const postRes = await anon('GET', `/api/content/blog/${post.slug}`);
    expect(postRes.status).toBe(200);
    const { post: fetched } = await postRes.json();
    expect(fetched.title).toBe('Real News');
  });

  it('an unknown slug is 404, not 500', async () => {
    const res = await anon('GET', '/api/content/blog/no-such-post');
    expect(res.status).toBe(404);
  });
});

describe('no anonymous write path to the blog', () => {
  it('every admin blog verb denies an anonymous caller', async () => {
    vi.spyOn(jwt, 'verifyAccessJwt').mockRejectedValue(new jwt.AuthError('no token'));
    const post = await savePost(env.DB, { title: 'Guard Check', bodyMarkdown: 'x' }, 'k@x.com');

    const results = {};
    for (const [m, p, b] of [
      ['GET', '/api/admin/blog'],
      ['GET', `/api/admin/blog/${post.slug}`],
      ['PUT', `/api/admin/blog/${post.slug}`, { title: 'x', bodyMarkdown: 'y' }],
      ['POST', '/api/admin/blog', { title: 'x', bodyMarkdown: 'y' }],
      ['POST', `/api/admin/blog/${post.slug}/publish`],
      ['DELETE', `/api/admin/blog/${post.slug}`],
    ]) {
      results[`${m} ${p}`] = (await anon(m, p, b)).status;
    }
    const anySuccess = Object.values(results).some((s) => s >= 200 && s < 300);
    expect({ anySuccess, results }).toEqual({ anySuccess: false, results });
  });

  it('denies a caller without the blog permission', async () => {
    await seedUser('no-blog@example.com', { media: true });
    asUser('no-blog@example.com');
    expect((await anon('GET', '/api/admin/blog')).status).toBe(403);
    expect((await anon('POST', '/api/admin/blog', { title: 'x', bodyMarkdown: 'y' })).status).toBe(403);
  });
});

describe('admin blog routes', () => {
  it('lists drafts and published posts alike', async () => {
    await seedUser('editor@example.com', { blog: true });
    asUser('editor@example.com');
    await savePost(env.DB, { title: 'Admin Visible Draft', bodyMarkdown: 'x' }, 'editor@example.com');

    const res = await anon('GET', '/api/admin/blog');
    expect(res.status).toBe(200);
    const { posts } = await res.json();
    expect(posts.map((p) => p.title)).toContain('Admin Visible Draft');
  });

  it('creates a post via POST and returns 201', async () => {
    await seedUser('creator@example.com', { blog: true });
    asUser('creator@example.com');

    const res = await anon('POST', '/api/admin/blog', { title: 'Created Post', bodyMarkdown: 'body text' });
    expect(res.status).toBe(201);
    const { post } = await res.json();
    expect(post.slug).toBe('created-post');
    expect(post.status).toBe('draft');
  });

  it('a malformed create returns 400, not 500', async () => {
    await seedUser('bad-input@example.com', { blog: true });
    asUser('bad-input@example.com');

    const res = await anon('POST', '/api/admin/blog', { title: '' });
    expect(res.status).toBe(400);
  });

  it('updates a post via PUT on its slug, keeping the slug stable', async () => {
    await seedUser('updater@example.com', { blog: true });
    asUser('updater@example.com');
    const created = await savePost(env.DB, { title: 'Original Title', bodyMarkdown: 'v1' }, 'updater@example.com');

    const res = await anon('PUT', `/api/admin/blog/${created.slug}`, { title: 'New Title', bodyMarkdown: 'v2' });
    expect(res.status).toBe(200);
    const { post } = await res.json();
    expect(post.slug).toBe(created.slug);
    expect(post.title).toBe('New Title');
  });

  it('PUT to an unknown slug is 404, not 500', async () => {
    await seedUser('updater2@example.com', { blog: true });
    asUser('updater2@example.com');

    const res = await anon('PUT', '/api/admin/blog/does-not-exist', { title: 'x', bodyMarkdown: 'y' });
    expect(res.status).toBe(404);
  });

  it('publish flips status to published and it becomes publicly visible', async () => {
    await seedUser('publisher@example.com', { blog: true });
    asUser('publisher@example.com');
    const created = await savePost(env.DB, { title: 'Publish Me', bodyMarkdown: 'x' }, 'publisher@example.com');

    const res = await anon('POST', `/api/admin/blog/${created.slug}/publish`);
    expect(res.status).toBe(200);
    const { post } = await res.json();
    expect(post.status).toBe('published');

    const publicRes = await anon('GET', `/api/content/blog/${created.slug}`);
    expect(publicRes.status).toBe(200);
  });

  it('publishing with a private hero image is refused with the BlogError status, not 500', async () => {
    await seedUser('hero-publisher@example.com', { blog: true, media: true });
    asUser('hero-publisher@example.com');

    const { storeUpload } = await import('../../worker/media/repository.js');
    const JPEG = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, ...new Array(64).fill(0x41)]);
    const media = await storeUpload(env, {
      bytes: JPEG, filename: 'kid.jpg', contentType: 'image/jpeg', uploaderEmail: 'hero-publisher@example.com',
    });
    const created = await savePost(env.DB, {
      title: 'Has Private Hero', bodyMarkdown: 'x', heroMediaKey: media.key,
    }, 'hero-publisher@example.com');

    const res = await anon('POST', `/api/admin/blog/${created.slug}/publish`);
    expect(res.status).toBe(400);

    const publicRes = await anon('GET', `/api/content/blog/${created.slug}`);
    expect(publicRes.status).toBe(404);
  });

  it('deletes a post and writes an audit row', async () => {
    await seedUser('deleter@example.com', { blog: true });
    asUser('deleter@example.com');
    const created = await savePost(env.DB, { title: 'Delete Me', bodyMarkdown: 'x' }, 'deleter@example.com');

    const res = await anon('DELETE', `/api/admin/blog/${created.slug}`);
    expect(res.status).toBe(200);

    const gone = await anon('GET', `/api/admin/blog/${created.slug}`);
    expect(gone.status).toBe(404);

    const row = await env.DB.prepare(
      'SELECT * FROM audit_log WHERE action = ? AND detail = ?',
    ).bind('blog.delete', created.slug).first();
    expect(row).not.toBeNull();
    expect(row.actor_email).toBe('deleter@example.com');
  });

  it('an admin can use blog routes without the explicit blog flag', async () => {
    await seedUser('blog-admin@example.com', {}, true);
    asUser('blog-admin@example.com');

    const res = await anon('GET', '/api/admin/blog');
    expect(res.status).toBe(200);
  });
});
