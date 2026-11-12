/**
 * Modular exponentiation against right-to-left binary exponentiation in
 * BigInt, an independent order of the same idea: the result, and in every
 * column of the table c is the prefix of b read so far and d = a^c mod n.
 * CLRS's figure for 7^560 mod 561 is reproduced exactly.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';

/** a^b mod n from the least significant bit up. */
function power(a: number, b: number, n: number): bigint {
  let [base, e, result] = [BigInt(a) % BigInt(n), BigInt(b), 1n % BigInt(n)];
  while (e > 0n) {
    if (e & 1n) result = (result * base) % BigInt(n);
    base = (base * base) % BigInt(n);
    e >>= 1n;
  }
  return result;
}

describe('modular-exponentiation', () => {
  it('fills CLRS’s table for 7^560 mod 561', () => {
    const { document, results } = runOk('modular-exponentiation', {
      a: 7,
      b: 560,
      n: 561,
    });
    expect(results).toEqual([1]);
    const rows = stateOf(replay(document), 'bits', 'table').data;
    expect(rows[0]).toEqual([1, 0, 0, 0, 1, 1, 0, 0, 0, 0]);
    expect(rows[1]).toEqual([1, 2, 4, 8, 17, 35, 70, 140, 280, 560]);
    expect(rows[2]).toEqual([
      '7',
      '49',
      '157',
      '526',
      '160',
      '241',
      '298',
      '166',
      '67',
      '1',
    ]);
  });

  it('agrees with right-to-left exponentiation, column by column', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000_000 }),
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        fc.integer({ min: 1, max: 1_000_000_000 }),
        (a, b, n) => {
          const { document, results } = runOk('modular-exponentiation', {
            a,
            b,
            n,
          });
          expect(results).toEqual([Number(power(a, b, n))]);
          const [, c, d] = stateOf(replay(document), 'bits', 'table').data;
          const bits = b.toString(2);
          c!.forEach((cj, j) => {
            expect(cj).toBe(parseInt(bits.slice(0, j + 1), 2));
            expect(d![j]).toBe(String(power(a, Number(cj), n)));
          });
          const ats = document.steps.map((s) => s.meta?.at);
          expect(ats.filter((x) => x === 'square')).toHaveLength(bits.length);
          expect(ats.filter((x) => x === 'multiply')).toHaveLength(
            [...bits].filter((x) => x === '1').length,
          );
        },
      ),
      fuzz,
    );
  });

  it('handles b = 0, n = 1 and a ≥ n', () => {
    expect(
      runOk('modular-exponentiation', { a: 5, b: 0, n: 7 }).results,
    ).toEqual([1]);
    expect(
      runOk('modular-exponentiation', { a: 5, b: 3, n: 1 }).results,
    ).toEqual([0]);
    expect(
      runOk('modular-exponentiation', { a: 12, b: 2, n: 5 }).results,
    ).toEqual([4]);
    expect(
      runOk('modular-exponentiation', { a: 0, b: 0, n: 2 }).results,
    ).toEqual([1]);
  });

  it('refuses a modulus of 0 and an exponent too large', () => {
    expect(runError('modular-exponentiation', { a: 2, b: 3, n: 0 }).path).toBe(
      '$.input.n',
    );
    expect(
      runError('modular-exponentiation', { a: 2, b: 2 ** 31, n: 5 }).path,
    ).toBe('$.input.b');
  });
});
