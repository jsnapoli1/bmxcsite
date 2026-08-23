import { describe, it, expect, vi } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';
import * as jwt from '../../worker/auth/jwt.js';
const call=(m,p,b)=>app.fetch(new Request(`https://bmxc.camp${p}`,{method:m,
  headers:b?{'content-type':'application/json'}:{},body:b?JSON.stringify(b):undefined}),env);

/**
 * The self-lockout guard and the strict boolean coercion were tightened after
 * a sole admin was able to demote themselves with `isAdmin: 0`. Tightening a
 * guard is easy to overdo: a guard that also blocks an admin from editing
 * their own name, or turns a 404 into a 500, trades one bug for another.
 * These tests pin the things that must STILL work.
 */
describe('hardening did not over-reject', () => {
  it('admin can still edit their own name', async () => {
    await env.DB.prepare('INSERT INTO users (email,name,is_admin) VALUES (?,?,1)').bind('a@x.com','Old').run();
    vi.spyOn(jwt,'verifyAccessJwt').mockResolvedValue('a@x.com');
    const res = await call('PATCH','/api/admin/users/a@x.com',{name:'New'});
    const row = await env.DB.prepare('SELECT name,is_admin FROM users WHERE email=?').bind('a@x.com').first();
    expect({status:res.status, name:row.name, admin:row.is_admin}).toEqual({status:200,name:'New',admin:1});
  });
  it('admin can still edit their own permissions', async () => {
    await env.DB.prepare('INSERT INTO users (email,is_admin) VALUES (?,1)').bind('b@x.com').run();
    vi.spyOn(jwt,'verifyAccessJwt').mockResolvedValue('b@x.com');
    const res = await call('PATCH','/api/admin/users/b@x.com',{permissions:{blog:true}});
    expect(res.status).toBe(200);
  });
  it('admin can explicitly reaffirm isAdmin:true on self', async () => {
    await env.DB.prepare('INSERT INTO users (email,is_admin) VALUES (?,1)').bind('c@x.com').run();
    vi.spyOn(jwt,'verifyAccessJwt').mockResolvedValue('c@x.com');
    expect((await call('PATCH','/api/admin/users/c@x.com',{isAdmin:true})).status).toBe(200);
  });
  it('404 still returns 404, not 500 (onError does not swallow)', async () => {
    await env.DB.prepare('INSERT INTO users (email,is_admin) VALUES (?,1)').bind('d@x.com').run();
    vi.spyOn(jwt,'verifyAccessJwt').mockResolvedValue('d@x.com');
    expect((await call('GET','/api/nonexistent')).status).toBe(404);
    expect((await call('PATCH','/api/admin/users/ghost@x.com',{name:'x'})).status).toBe(404);
  });
  it('ordinary emails still accepted after the length bound', async () => {
    await env.DB.prepare('INSERT INTO users (email,is_admin) VALUES (?,1)').bind('e@x.com').run();
    vi.spyOn(jwt,'verifyAccessJwt').mockResolvedValue('e@x.com');
    for (const em of ['ken@bmxc.camp','sarah.schnitter+camp@gmail.com','a@b.co']) {
      expect((await call('POST','/api/admin/users',{email:em})).status).toBe(201);
    }
    expect((await call('POST','/api/admin/users',{email:'x'.repeat(250)+'@x.com'})).status).toBe(400);
  });
});
