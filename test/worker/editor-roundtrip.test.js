import { describe, it, expect, vi } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';
import * as jwt from '../../worker/auth/jwt.js';
import { buildSeedPayload } from '../../scripts/seed-content.js';
import { saveArea, publishArea, getPublished } from '../../worker/content/repository.js';

const call = (m,p,b) => app.fetch(new Request(`https://bmxc.camp${p}`, { method:m,
  headers: b?{'content-type':'application/json'}:{}, body: b?JSON.stringify(b):undefined }), env);

/**
 * An editor loads content, the director changes one thing, and it saves the
 * whole area back. If the editor's shape drops a field the API returned, that
 * field is silently gone. This simulates the load->save cycle at the API
 * boundary and asserts nothing is lost.
 */
describe('editor load-then-save loses nothing', () => {
  it.each(['staff','faq','merch','campinfo'])('%s survives a no-op round trip', async (area) => {
    await env.DB.prepare('INSERT INTO users (email,is_admin) VALUES (?,1)').bind('a@x.com').run();
    vi.spyOn(jwt,'verifyAccessJwt').mockResolvedValue('a@x.com');

    await saveArea(env.DB, area, buildSeedPayload()[area], 'seed');
    await publishArea(env.DB, area, 'seed');
    const original = await getPublished(env.DB, area);

    // What the editor loads:
    const loaded = await (await call('GET', `/api/admin/content/${area}`)).json();
    // Save it straight back, unchanged, as an editor would on any edit:
    const res = await call('PUT', `/api/admin/content/${area}`, loaded.draft);
    expect(res.status).toBe(200);
    await call('POST', `/api/admin/content/${area}/publish`);

    expect(await getPublished(env.DB, area)).toEqual(original);
  });
});
