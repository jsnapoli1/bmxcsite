/**
 * What a registration costs.
 *
 * Shared by the public page and the worker, and the worker recomputes
 * from it rather than trusting anything a form sent. A price arriving in
 * a request body is a number an attacker chose.
 *
 * Money is integer cents throughout. Floating point dollars accumulate
 * error the moment a discount is applied, and this is real money.
 */
import {
  PRICE_TIERS, BUS_ROUTES, DEPOSIT, SIBLING_DISCOUNT,
} from '../data/registration.js';

export const DEPOSIT_CENTS = DEPOSIT * 100;

/**
 * 'MM-DD' for a date, in UTC.
 *
 * UTC deliberately: a tier boundary that shifted with the viewer's
 * timezone would price two people differently for the same instant, and
 * whether a registration is Early Bird would depend on where the worker
 * happened to run.
 */
function monthDay(date) {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${month}-${day}`;
}

/**
 * The price tier for a date, or null outside the registration window.
 *
 * Null rather than a fallback tier: registration closing is a real state,
 * and quietly charging the last known price to someone registering in
 * August would be worse than refusing.
 */
export function tierFor(date) {
  const key = monthDay(date);
  return PRICE_TIERS.find((tier) => key >= tier.from && key <= tier.to) ?? null;
}

/** Cents for a bus route key. Unknown or absent means own transport. */
export function busCents(route) {
  const found = BUS_ROUTES.find((bus) => bus.key === route);
  return found ? found.price * 100 : 0;
}

/**
 * The full breakdown, or null outside the registration window.
 *
 * `siblingIndex` is how many registrations this guardian already has
 * confirmed — 0 for the first child, 1 for the second, and so on.
 */
export function quote({ date, busRoute, siblingIndex = 0 }) {
  const tier = tierFor(date);
  if (tier === null) return null;

  const baseCents = tier.price * 100;
  const bus = busCents(busRoute);
  const siblingDiscountCents = siblingIndex > 0 ? SIBLING_DISCOUNT * 100 : 0;

  // Clamped at zero: a future discount larger than the base price must
  // not produce a negative charge.
  const totalCents = Math.max(0, baseCents + bus - siblingDiscountCents);

  // The camp's rule: before June the deposit is taken now and the balance
  // billed at the end of May; from June 1 the whole amount is due at
  // registration.
  const isJuneOrLater = monthDay(date) >= '06-01';
  const balanceDueAt = isJuneOrLater
    ? date.toISOString().slice(0, 10)
    : `${date.getUTCFullYear()}-05-31`;

  return {
    tier: tier.name,
    baseCents,
    busCents: bus,
    siblingDiscountCents,
    totalCents,
    depositCents: DEPOSIT_CENTS,
    balanceDueCents: Math.max(0, totalCents - DEPOSIT_CENTS),
    balanceDueAt,
  };
}
