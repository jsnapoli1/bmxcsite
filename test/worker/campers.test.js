import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import {
  listCampers, upsertCamper, recordConsent, withdrawConsent,
  consentedRoster, mayEnroll, RosterError,
} from '../../worker/faces/roster.js';

describe('upsertCamper', () => {
  it('adds a camper with no consent', async () => {
    const row = await upsertCamper(env.DB, { bib: '101', name: 'Alex Kim', actorEmail: 'a@b.c' });
    expect(row.bib).toBe('101');
    expect(row.consent_at).toBeNull();
  });

  it('refuses a blank bib', async () => {
    await expect(
      upsertCamper(env.DB, { bib: '  ', name: 'X', actorEmail: 'a@b.c' }),
    ).rejects.toThrow(RosterError);
  });

  it('refuses a blank name', async () => {
    await expect(
      upsertCamper(env.DB, { bib: '102', name: '', actorEmail: 'a@b.c' }),
    ).rejects.toThrow(RosterError);
  });

  it('updating a camper neither grants nor revokes consent', async () => {
    // Editing a name must never be a path to consenting on a family's
    // behalf, and must not silently undo a consent already recorded.
    await upsertCamper(env.DB, { bib: '103', name: 'Before', actorEmail: 'a@b.c' });
    await recordConsent(env.DB, '103', 'a@b.c');
    const updated = await upsertCamper(env.DB, { bib: '103', name: 'After', actorEmail: 'a@b.c' });
    expect(updated.name).toBe('After');
    expect(updated.consent_at).not.toBeNull();
  });
});

describe('mayEnroll', () => {
  it('refuses a bib with no camper at all', async () => {
    expect(await mayEnroll(env.DB, '999')).toBe(false);
  });

  it('refuses a camper who has not consented', async () => {
    await upsertCamper(env.DB, { bib: '201', name: 'No Consent', actorEmail: 'a@b.c' });
    expect(await mayEnroll(env.DB, '201')).toBe(false);
  });

  it('allows a camper who has consented', async () => {
    await upsertCamper(env.DB, { bib: '202', name: 'Yes', actorEmail: 'a@b.c' });
    await recordConsent(env.DB, '202', 'a@b.c');
    expect(await mayEnroll(env.DB, '202')).toBe(true);
  });

  it('refuses again once consent is withdrawn', async () => {
    // A family changing their mind must take effect immediately.
    await upsertCamper(env.DB, { bib: '203', name: 'Changed Mind', actorEmail: 'a@b.c' });
    await recordConsent(env.DB, '203', 'a@b.c');
    await withdrawConsent(env.DB, '203', 'a@b.c');
    expect(await mayEnroll(env.DB, '203')).toBe(false);
  });

  it('is not fooled by a bib that differs only in whitespace', async () => {
    await upsertCamper(env.DB, { bib: '204', name: 'Padded', actorEmail: 'a@b.c' });
    await recordConsent(env.DB, '204', 'a@b.c');
    expect(await mayEnroll(env.DB, ' 204 ')).toBe(true);
  });

  it('refuses an empty bib rather than matching something', async () => {
    expect(await mayEnroll(env.DB, '')).toBe(false);
    expect(await mayEnroll(env.DB, null)).toBe(false);
  });
});

describe('consentedRoster', () => {
  it('includes only campers who consented', async () => {
    await upsertCamper(env.DB, { bib: '301', name: 'In', actorEmail: 'a@b.c' });
    await recordConsent(env.DB, '301', 'a@b.c');
    await upsertCamper(env.DB, { bib: '302', name: 'Out', actorEmail: 'a@b.c' });

    const roster = await consentedRoster(env.DB);
    expect(roster['301']).toBe('In');
    expect(roster).not.toHaveProperty('302');
  });

  it('drops a camper whose consent was withdrawn', async () => {
    await upsertCamper(env.DB, { bib: '303', name: 'Gone', actorEmail: 'a@b.c' });
    await recordConsent(env.DB, '303', 'a@b.c');
    await withdrawConsent(env.DB, '303', 'a@b.c');

    const roster = await consentedRoster(env.DB);
    expect(roster).not.toHaveProperty('303');
  });

  it('is empty rather than everyone when nobody has consented', async () => {
    // The failure that matters: a bug returning the whole roster would
    // enroll every child at the camp. Empty is the safe direction.
    await env.DB.prepare('DELETE FROM campers').run();
    await upsertCamper(env.DB, { bib: '401', name: 'A', actorEmail: 'a@b.c' });
    await upsertCamper(env.DB, { bib: '402', name: 'B', actorEmail: 'a@b.c' });
    const roster = await consentedRoster(env.DB);
    expect(Object.keys(roster)).toHaveLength(0);
  });
});

describe('recordConsent', () => {
  it('records who recorded it and when', async () => {
    await upsertCamper(env.DB, { bib: '501', name: 'Logged', actorEmail: 'a@b.c' });
    const row = await recordConsent(env.DB, '501', 'director@bmxc.camp');
    expect(row.consent_at).toBeGreaterThan(0);
    expect(row.consent_by).toBe('director@bmxc.camp');
  });

  it('returns null for a camper that is not there', async () => {
    expect(await recordConsent(env.DB, 'nobody', 'a@b.c')).toBeNull();
  });
});

describe('listCampers', () => {
  it('orders by bib numerically, not as text', async () => {
    // '9' after '10' is what string ordering gives, and a roster sorted
    // that way is hard to scan.
    await env.DB.prepare('DELETE FROM campers').run();
    await upsertCamper(env.DB, { bib: '10', name: 'Ten', actorEmail: 'a@b.c' });
    await upsertCamper(env.DB, { bib: '9', name: 'Nine', actorEmail: 'a@b.c' });

    const rows = await listCampers(env.DB);
    expect(rows.map((r) => r.bib)).toEqual(['9', '10']);
  });
});
