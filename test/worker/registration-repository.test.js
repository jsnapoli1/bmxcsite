import { env } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDraft, updateDraft, getByReference, confirmedSiblingCount,
  listRegistrations, cancelRegistration, RegistrationError,
} from '../../worker/registration/repository.js';

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM payments').run();
  await env.DB.prepare('DELETE FROM registrations').run();
});

describe('createDraft', () => {
  it('starts as a draft with a reference', async () => {
    const row = await createDraft(env.DB, { camperName: 'Alex Kim' });
    expect(row.status).toBe('draft');
    expect(row.reference).toBeTruthy();
  });

  it('gives every draft a different reference', async () => {
    const a = await createDraft(env.DB, { camperName: 'A' });
    const b = await createDraft(env.DB, { camperName: 'B' });
    expect(a.reference).not.toBe(b.reference);
  });

  it('starts with photo consent off', async () => {
    // An absent decision must read as no. Face tagging is opt-in.
    const row = await createDraft(env.DB, { camperName: 'No Consent' });
    expect(row.photo_consent).toBe(0);
  });

  it('only a literal true consents', async () => {
    // A truthy string from a form must not grant consent on a family's
    // behalf. Same rule as isAdmin in worker/routes/users.js.
    const row = await createDraft(env.DB, { camperName: 'Coerced', photoConsent: 'false' });
    expect(row.photo_consent).toBe(0);
  });

  it('starts with nothing paid', async () => {
    const row = await createDraft(env.DB, { camperName: 'Unpaid' });
    expect(row.deposit_paid_cents).toBe(0);
    expect(row.confirmed_at).toBeNull();
  });
});

describe('updateDraft', () => {
  it('updates the fields it is given', async () => {
    const { reference } = await createDraft(env.DB, { camperName: 'Before' });
    const row = await updateDraft(env.DB, reference, { camperName: 'After', busRoute: 'ny' });
    expect(row.camper_name).toBe('After');
    expect(row.bus_route).toBe('ny');
  });

  it('leaves fields it was not given alone', async () => {
    const { reference } = await createDraft(env.DB, {
      camperName: 'Keep', guardianEmail: 'g@x.com',
    });
    const row = await updateDraft(env.DB, reference, { busRoute: 'nj' });
    expect(row.camper_name).toBe('Keep');
    expect(row.guardian_email).toBe('g@x.com');
  });

  it('cannot set status', async () => {
    // Only the Stripe webhook may confirm. A form field named `status`
    // must not be a second path to a paid registration.
    const { reference } = await createDraft(env.DB, { camperName: 'X' });
    await updateDraft(env.DB, reference, { status: 'confirmed' });
    const row = await getByReference(env.DB, reference);
    expect(row.status).toBe('draft');
  });

  it('cannot set the amount paid', async () => {
    const { reference } = await createDraft(env.DB, { camperName: 'X' });
    await updateDraft(env.DB, reference, { depositPaidCents: 999999 });
    const row = await getByReference(env.DB, reference);
    expect(row.deposit_paid_cents).toBe(0);
  });

  it('cannot set the total', async () => {
    const { reference } = await createDraft(env.DB, { camperName: 'X' });
    await updateDraft(env.DB, reference, { totalCents: 1, total_cents: 1 });
    const row = await getByReference(env.DB, reference);
    expect(row.total_cents).toBeNull();
  });

  it('refuses to touch a confirmed registration', async () => {
    const { reference } = await createDraft(env.DB, { camperName: 'Done' });
    await env.DB.prepare(
      "UPDATE registrations SET status = 'confirmed' WHERE reference = ?",
    ).bind(reference).run();

    await expect(
      updateDraft(env.DB, reference, { camperName: 'Changed' }),
    ).rejects.toThrow(RegistrationError);
  });

  it('returns null for a reference that does not exist', async () => {
    expect(await updateDraft(env.DB, 'NOPE', { camperName: 'X' })).toBeNull();
  });
});

describe('confirmedSiblingCount', () => {
  it('counts only confirmed registrations for that guardian', async () => {
    const a = await createDraft(env.DB, { guardianEmail: 'fam@x.com', camperName: 'One' });
    await env.DB.prepare("UPDATE registrations SET status='confirmed' WHERE id = ?")
      .bind(a.id).run();
    await createDraft(env.DB, { guardianEmail: 'fam@x.com', camperName: 'Two (draft)' });
    await createDraft(env.DB, { guardianEmail: 'other@x.com', camperName: 'Someone else' });

    expect(await confirmedSiblingCount(env.DB, 'fam@x.com')).toBe(1);
  });

  it('is case-insensitive on the email', async () => {
    const a = await createDraft(env.DB, { guardianEmail: 'case@x.com', camperName: 'One' });
    await env.DB.prepare("UPDATE registrations SET status='confirmed' WHERE id = ?")
      .bind(a.id).run();
    expect(await confirmedSiblingCount(env.DB, 'CASE@X.COM')).toBe(1);
  });

  it('is zero for an unknown guardian', async () => {
    expect(await confirmedSiblingCount(env.DB, 'nobody@x.com')).toBe(0);
  });

  it('does not let drafts earn the discount', async () => {
    // Otherwise a family gets it by opening tabs.
    await createDraft(env.DB, { guardianEmail: 'tabs@x.com', camperName: 'A' });
    await createDraft(env.DB, { guardianEmail: 'tabs@x.com', camperName: 'B' });
    expect(await confirmedSiblingCount(env.DB, 'tabs@x.com')).toBe(0);
  });
});

describe('cancelRegistration', () => {
  it('marks it cancelled and records when', async () => {
    const { reference } = await createDraft(env.DB, { camperName: 'Going' });
    const row = await cancelRegistration(env.DB, reference);
    expect(row.status).toBe('cancelled');
    expect(row.cancelled_at).toBeGreaterThan(0);
  });

  it('returns null for an unknown reference', async () => {
    expect(await cancelRegistration(env.DB, 'NOPE')).toBeNull();
  });
});

describe('listRegistrations', () => {
  it('filters by status', async () => {
    const a = await createDraft(env.DB, { camperName: 'Confirmed one' });
    await env.DB.prepare("UPDATE registrations SET status='confirmed' WHERE id=?")
      .bind(a.id).run();
    await createDraft(env.DB, { camperName: 'Draft one' });

    const rows = await listRegistrations(env.DB, { status: 'confirmed' });
    expect(rows).toHaveLength(1);
    expect(rows[0].camper_name).toBe('Confirmed one');
  });
});
