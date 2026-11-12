/**
 * Euclid's algorithm against a gcd found by trial division, and the
 * extended form against Bézout's identity: d = ax + by, with d the gcd.
 * The number of calls stays within Lamé's bound, and the table of calls
 * reads as CLRS's figure of EXTENDED-EUCLID(99, 78).
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';

/** The greatest common divisor by trying every candidate. */
function gcdByTrial(a: number, b: number): number {
  if (b === 0) return a;
  if (a === 0) return b;
  for (let d = Math.min(a, b); d > 1; d--)
    if (a % d === 0 && b % d === 0) return d;
  return 1;
}

const pairs = fc
  .tuple(fc.integer({ min: 0, max: 5000 }), fc.integer({ min: 0, max: 5000 }))
  .filter(([a, b]) => a > 0 || b > 0);

describe('euclid', () => {
  it('finds gcd(30, 21) = 3', () => {
    expect(runOk('euclid', { a: 30, b: 21 }).results).toEqual([3]);
  });

  it('agrees with trial division, within Lamé’s bound of calls', () => {
    fc.assert(
      fc.property(pairs, ([a, b]) => {
        const { document, results } = runOk('euclid', { a, b });
        expect(results).toEqual([gcdByTrial(a, b)]);
        // Lamé: k recursive calls need b ≥ F(k + 1).
        const calls = document.steps.filter(
          (s) => s.meta?.at === 'call',
        ).length;
        const fib = [0, 1];
        while (fib.length < calls + 3) fib.push(fib.at(-1)! + fib.at(-2)!);
        if (a > b && calls > 0)
          expect(b).toBeGreaterThanOrEqual(fib[calls + 1]!);
      }),
      fuzz,
    );
  });

  it('handles 0 and refuses gcd(0, 0)', () => {
    expect(runOk('euclid', { a: 0, b: 7 }).results).toEqual([7]);
    expect(runOk('euclid', { a: 7, b: 0 }).results).toEqual([7]);
    expect(runError('euclid', { a: 0, b: 0 }).message).toMatch(/not defined/);
    expect(
      runOk('euclid', { a: 1_000_000_000, b: 999_999_999 }).results,
    ).toEqual([1]);
  });
});

describe('extended-euclid', () => {
  it('fills CLRS’s table for (99, 78)', () => {
    const { document, results } = runOk('extended-euclid', { a: 99, b: 78 });
    expect(results).toEqual([3, -11, 14]);
    expect(stateOf(replay(document), 'calls', 'table').data).toEqual([
      [99, 78, 1, 3, -11, 14],
      [78, 21, 3, 3, 3, -11],
      [21, 15, 1, 3, -2, 3],
      [15, 6, 2, 3, 1, -2],
      [6, 3, 2, 3, 0, 1],
      [3, 0, '', 3, 1, 0],
    ]);
  });

  it('gives d = ax + by with d the gcd', () => {
    fc.assert(
      fc.property(pairs, ([a, b]) => {
        const { results } = runOk('extended-euclid', { a, b });
        const [d, x, y] = results as number[];
        expect(d).toBe(gcdByTrial(a, b));
        expect(a * x! + b * y!).toBe(d);
        // The coefficients stay small: |x| ≤ b/d and |y| ≤ a/d.
        if (a > 0 && b > 0) {
          expect(Math.abs(x!)).toBeLessThanOrEqual(b / d!);
          expect(Math.abs(y!)).toBeLessThanOrEqual(a / d!);
        }
      }),
      fuzz,
    );
  });

  it('works at the largest operands', () => {
    const [d, x, y] = runOk('extended-euclid', {
      a: 1_000_000_000,
      b: 701_408_733,
    }).results as number[];
    // In BigInt: a·x passes 2^53, though x and y themselves do not.
    expect(1_000_000_000n * BigInt(x!) + 701_408_733n * BigInt(y!)).toBe(
      BigInt(d!),
    );
  });
});
