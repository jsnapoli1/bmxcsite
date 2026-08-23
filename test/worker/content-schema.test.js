import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';

describe('content schema', () => {
  it('stores an ordered staff group with members', async () => {
    await env.DB.prepare(
      `INSERT INTO staff_groups (id, title, sort_order, status, updated_by)
       VALUES (1, ?, 0, 'published', ?)`,
    ).bind('Camp Directors', 'ken@example.com').run();

    await env.DB.prepare(
      `INSERT INTO staff_members (group_id, name, role, bio, sort_order, status, updated_by)
       VALUES (1, ?, ?, ?, 0, 'published', ?)`,
    ).bind('Ken Crawford', 'Camp Director', 'Bio here', 'ken@example.com').run();

    const group = await env.DB.prepare(
      'SELECT * FROM staff_groups WHERE id = 1',
    ).first();
    const member = await env.DB.prepare(
      'SELECT * FROM staff_members WHERE group_id = 1',
    ).first();

    expect(group.title).toBe('Camp Directors');
    expect(group.status).toBe('published');
    expect(member.name).toBe('Ken Crawford');
    expect(typeof group.updated_at).toBe('number');
  });

  it('defaults new rows to draft', async () => {
    await env.DB.prepare(
      'INSERT INTO faq_categories (id, label, updated_by) VALUES (1, ?, ?)',
    ).bind('Registration', 'ken@example.com').run();
    const row = await env.DB.prepare(
      'SELECT status FROM faq_categories WHERE id = 1',
    ).first();
    expect(row.status).toBe('draft');
  });

  it('cascades a group delete to its members', async () => {
    await env.DB.prepare(
      'INSERT INTO staff_groups (id, title, updated_by) VALUES (9, ?, ?)',
    ).bind('Temp', 'a@b.com').run();
    await env.DB.prepare(
      `INSERT INTO staff_members (group_id, name, updated_by)
       VALUES (9, ?, ?)`,
    ).bind('Someone', 'a@b.com').run();

    await env.DB.prepare('DELETE FROM staff_groups WHERE id = 9').run();

    const { n } = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM staff_members WHERE group_id = 9',
    ).first();
    expect(n).toBe(0);
  });

  it('tracks a version number per area', async () => {
    await env.DB.prepare(
      "INSERT INTO content_version (area, version) VALUES ('staff', 1)",
    ).run();
    await env.DB.prepare(
      "UPDATE content_version SET version = version + 1 WHERE area = 'staff'",
    ).run();
    const row = await env.DB.prepare(
      "SELECT version FROM content_version WHERE area = 'staff'",
    ).first();
    expect(row.version).toBe(2);
  });
});
