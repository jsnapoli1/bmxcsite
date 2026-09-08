import { describe, it, expect } from 'vitest';
import { tenureSentence } from '../../src/pages/StaffMember.jsx';

/**
 * Tenure is written as a sentence rather than a `Since: 2006` label — none of
 * the NCAA staff pages surveyed uses a label, and a bare year reads like a
 * footnote.
 *
 * It is computed at render rather than stored, so it cannot go stale. That
 * makes the arithmetic worth pinning: the count is inclusive (someone who
 * started in 2006 is in their 20th summer in 2025, not their 19th), and the
 * ordinal suffix has to survive the teens.
 */
describe('tenureSentence', () => {
  it('counts the first summer as the first, not the zeroth', () => {
    expect(tenureSentence(2025, 2025)).toBe('In their 1st summer at Blue Mountain.');
  });

  it('counts inclusively', () => {
    expect(tenureSentence(2006, 2025)).toBe('In their 20th summer at Blue Mountain.');
  });

  it.each([
    [2024, 2025, '2nd'],
    [2023, 2025, '3rd'],
    [2022, 2025, '4th'],
  ])('uses the right suffix for %s', (since, year, expected) => {
    expect(tenureSentence(since, year)).toContain(`${expected} summer`);
  });

  it('says 11th, 12th, 13th — not 11st, 12nd, 13rd', () => {
    // The case a naive `n % 10` lookup gets wrong.
    expect(tenureSentence(2015, 2025)).toContain('11th');
    expect(tenureSentence(2014, 2025)).toContain('12th');
    expect(tenureSentence(2013, 2025)).toContain('13th');
  });

  it('still says 21st and 22nd above the teens', () => {
    expect(tenureSentence(2005, 2025)).toContain('21st');
    expect(tenureSentence(2004, 2025)).toContain('22nd');
  });

  it('answers null rather than inventing a tenure', () => {
    // A missing year is the common case — most staff have no `since`.
    expect(tenureSentence(undefined)).toBeNull();
    expect(tenureSentence(null)).toBeNull();
    expect(tenureSentence('')).toBeNull();
    expect(tenureSentence('not a year')).toBeNull();
  });

  it('answers null for a start year in the future', () => {
    // Otherwise a typo renders "In their 0th summer".
    expect(tenureSentence(2030, 2025)).toBeNull();
  });

  it('accepts a year stored as a string, which is what a text input gives', () => {
    expect(tenureSentence('2006', 2025)).toBe('In their 20th summer at Blue Mountain.');
  });
});
