import { describe, it, expect } from 'vitest';
import { tierFor, busCents, quote, DEPOSIT_CENTS } from '../../src/lib/pricing.js';
import { PRICE_TIERS } from '../../src/data/registration.js';

// Dates are constructed UTC so the test does not change meaning with the
// machine's timezone — a boundary test that passes in one zone and fails
// in another is worse than no test.
const on = (iso) => new Date(`${iso}T12:00:00Z`);

describe('the tier data itself', () => {
  it('gives every tier both the prose window and machine bounds', () => {
    // The two are kept in step by hand. If a tier gains a window and not
    // from/to, pricing silently stops matching it.
    for (const tier of PRICE_TIERS) {
      expect(tier.window).toBeTruthy();
      expect(tier.from).toMatch(/^\d{2}-\d{2}$/);
      expect(tier.to).toMatch(/^\d{2}-\d{2}$/);
    }
  });
});

describe('tierFor', () => {
  it('gives Early Bird on the first day of the window', () => {
    expect(tierFor(on('2026-01-01')).name).toBe('Early Bird');
  });

  it('gives Early Bird on the last day of the window', () => {
    expect(tierFor(on('2026-02-28')).name).toBe('Early Bird');
  });

  it('moves to Full Rate the next day', () => {
    expect(tierFor(on('2026-03-01')).name).toBe('Full Rate');
  });

  it('gives Late Rate through the end of June', () => {
    expect(tierFor(on('2026-06-30')).name).toBe('Late Rate');
  });

  it('returns null after registration closes', () => {
    // July is past the close date. The caller must refuse rather than
    // quietly charge the last known price.
    expect(tierFor(on('2026-07-01'))).toBeNull();
  });

  it('returns null before registration opens', () => {
    expect(tierFor(on('2025-12-31'))).toBeNull();
  });
});

describe('busCents', () => {
  it('prices the New Jersey route', () => expect(busCents('nj')).toBe(10000));
  it('prices the New York route', () => expect(busCents('ny')).toBe(12500));
  it('charges nothing for own transport', () => expect(busCents(null)).toBe(0));
  it('charges nothing for an unknown route', () => expect(busCents('mars')).toBe(0));
});

describe('quote', () => {
  it('prices an Early Bird with no bus', () => {
    const q = quote({ date: on('2026-01-15'), busRoute: null, siblingIndex: 0 });
    expect(q.baseCents).toBe(55500);
    expect(q.busCents).toBe(0);
    expect(q.siblingDiscountCents).toBe(0);
    expect(q.totalCents).toBe(55500);
  });

  it('adds the bus', () => {
    const q = quote({ date: on('2026-01-15'), busRoute: 'ny', siblingIndex: 0 });
    expect(q.totalCents).toBe(55500 + 12500);
  });

  it('discounts the second sibling but not the first', () => {
    const first = quote({ date: on('2026-01-15'), busRoute: null, siblingIndex: 0 });
    const second = quote({ date: on('2026-01-15'), busRoute: null, siblingIndex: 1 });
    expect(first.siblingDiscountCents).toBe(0);
    expect(second.siblingDiscountCents).toBe(5000);
    expect(second.totalCents).toBe(first.totalCents - 5000);
  });

  it('discounts the third sibling too', () => {
    const third = quote({ date: on('2026-01-15'), busRoute: null, siblingIndex: 2 });
    expect(third.siblingDiscountCents).toBe(5000);
  });

  it('always takes the same deposit', () => {
    const q = quote({ date: on('2026-01-15'), busRoute: 'nj', siblingIndex: 0 });
    expect(q.depositCents).toBe(DEPOSIT_CENTS);
    expect(q.depositCents).toBe(25000);
  });

  it('leaves the rest as a balance', () => {
    const q = quote({ date: on('2026-01-15'), busRoute: null, siblingIndex: 0 });
    expect(q.balanceDueCents).toBe(q.totalCents - q.depositCents);
  });

  it('bills the balance at the end of May for an early registration', () => {
    const q = quote({ date: on('2026-01-15'), busRoute: null, siblingIndex: 0 });
    expect(q.balanceDueAt).toBe('2026-05-31');
  });

  it('takes the whole amount at once from June', () => {
    // The camp's rule: register on June 1 or later and the full balance
    // is due at registration.
    const q = quote({ date: on('2026-06-05'), busRoute: null, siblingIndex: 0 });
    expect(q.balanceDueAt).toBe('2026-06-05');
  });

  it('refuses to quote outside the registration window', () => {
    expect(quote({ date: on('2026-08-01'), busRoute: null, siblingIndex: 0 })).toBeNull();
  });

  it('never produces a negative total', () => {
    // Defence against a future discount larger than the base price.
    const q = quote({ date: on('2026-01-15'), busRoute: null, siblingIndex: 99 });
    expect(q.totalCents).toBeGreaterThanOrEqual(0);
  });

  it('works in whole cents only', () => {
    const q = quote({ date: on('2026-03-15'), busRoute: 'ny', siblingIndex: 1 });
    for (const value of Object.values(q)) {
      if (typeof value === 'number') expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('does not shift a tier boundary with the local timezone', () => {
    // Late evening UTC on the last Early Bird day is already March in
    // some zones. The tier must not depend on where the server ran.
    expect(tierFor(new Date('2026-02-28T23:59:00Z')).name).toBe('Early Bird');
    expect(tierFor(new Date('2026-03-01T00:01:00Z')).name).toBe('Full Rate');
  });
});

describe('cancellation cover', () => {
  it('adds $50 when taken', () => {
    const without = quote({ date: on('2026-01-15'), busRoute: null, siblingIndex: 0 });
    const with_ = quote({ date: on('2026-01-15'), busRoute: null, siblingIndex: 0, insurance: true });
    expect(with_.insuranceCents).toBe(5000);
    expect(with_.totalCents).toBe(without.totalCents + 5000);
  });

  it('charges nothing when declined', () => {
    const q = quote({ date: on('2026-01-15'), busRoute: null, siblingIndex: 0, insurance: false });
    expect(q.insuranceCents).toBe(0);
  });

  it('defaults to declined', () => {
    // Nobody is charged for cover they did not ask for.
    const q = quote({ date: on('2026-01-15'), busRoute: null, siblingIndex: 0 });
    expect(q.insuranceCents).toBe(0);
  });

  it('only a literal true buys it', () => {
    // Same rule as photo consent: a truthy string from a form must not
    // add a charge.
    const q = quote({ date: on('2026-01-15'), busRoute: null, siblingIndex: 0, insurance: 'yes' });
    expect(q.insuranceCents).toBe(0);
  });

  it('is not reduced by the sibling discount', () => {
    // The discount is off the camp fee. A second child's cover costs the
    // same $50 as the first.
    const q = quote({ date: on('2026-01-15'), busRoute: null, siblingIndex: 1, insurance: true });
    expect(q.insuranceCents).toBe(5000);
  });

  it('stacks with a bus', () => {
    const q = quote({ date: on('2026-01-15'), busRoute: 'ny', siblingIndex: 0, insurance: true });
    expect(q.totalCents).toBe(55500 + 12500 + 5000);
  });

  it('does not change the deposit', () => {
    // The deposit is what holds the place; cover is an extra on the
    // balance, not a bigger payment up front.
    const q = quote({ date: on('2026-01-15'), busRoute: null, siblingIndex: 0, insurance: true });
    expect(q.depositCents).toBe(25000);
    expect(q.balanceDueCents).toBe(q.totalCents - 25000);
  });
});
