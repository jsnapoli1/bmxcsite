import { describe, it, expect, vi } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';
import * as jwt from '../../worker/auth/jwt.js';
import { saveArea } from '../../worker/content/repository.js';

const anon = (m,p,b) => {
  const hasBody = b !== undefined && m !== 'GET' && m !== 'HEAD';
  return app.fetch(new Request(`https://bmxc.camp${p}`, {
    method: m,
    headers: hasBody ? {'content-type':'application/json'} : {},
    body: hasBody ? JSON.stringify(b) : undefined,
  }), env);
};

/**
 * The public content route is deliberately NOT behind Cloudflare Access —
 * the public site has to read content without authenticating. That makes
 * these the load-bearing checks: nothing anonymous may reach a write path,
 * and an unpublished draft must never appear on the public route.
 */
describe('no anonymous write path to content', () => {
  it('every admin content verb denies an anonymous caller', async () => {
    vi.spyOn(jwt,'verifyAccessJwt').mockRejectedValue(new jwt.AuthError('no token'));
    const results = {};
    for (const [m,p] of [
      ['GET','/api/admin/content/staff'],
      ['PUT','/api/admin/content/staff'],
      ['POST','/api/admin/content/staff/publish'],
      ['GET','/api/admin/content/merch'],
      ['PUT','/api/admin/content/merch'],
    ]) results[`${m} ${p}`] = (await anon(m,p,{groups:[]})).status;
    const anySuccess = Object.values(results).some(s => s >= 200 && s < 300);
    expect({ anySuccess, results }).toEqual({ anySuccess: false, results });
  });

  it('drafts are never visible on the public route', async () => {
    await saveArea(env.DB, 'staff', { groups: [
      { group: 'SECRET DRAFT', members: [{ name: 'X', role: 'Y', bio: 'z' }] },
    ] }, 'x@y.com');
    // saved but NOT published
    const res = await anon('GET','/api/content/staff');
    const body = await res.text();
    expect(body).not.toContain('SECRET DRAFT');
  });

  it('unknown area is 404, not 500', async () => {
    expect((await anon('GET','/api/content/billing')).status).toBe(404);
  });
});
