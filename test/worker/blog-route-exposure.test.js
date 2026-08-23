import { describe, it, expect, vi } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';
import * as jwt from '../../worker/auth/jwt.js';
import { savePost, publishPost } from '../../worker/content/blog.js';

const anon = (m,p) => app.fetch(new Request(`https://bmxc.camp${p}`, { method:m }), env);

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
