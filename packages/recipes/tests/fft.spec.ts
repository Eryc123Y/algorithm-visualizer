/**
 * The FFT against the definition of the DFT, y_k = Σ_j a_j ω_n^{kj} with
 * ω_n = e^{2πi/n}, summed directly: the final array holds y to three
 * decimals. The trace makes n/2 lg n butterflies after a bit-reversed
 * copy, and each step's numbers are written as the figures write them.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  reverseBits,
  root,
  showComplex,
  type Complex,
} from '../src/algorithms/math/fft.ts';
import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';

/** The DFT by its definition. */
function dft(a: readonly number[]): Complex[] {
  const n = a.length;
  return a.map((_, k) =>
    a.reduce(
      (y, aj, j) => {
        const w = root((k * j) % n, n);
        return { re: y.re + aj * w.re, im: y.im + aj * w.im };
      },
      { re: 0, im: 0 },
    ),
  );
}

/** Reads what showComplex writes. */
function parseComplex(text: string): Complex {
  const t = text.replaceAll('−', '-');
  const m = /^(-?[\d.]+)?(?:([+-]?)([\d.]*)i)?$/.exec(t);
  if (m === null || t === '') throw new Error(`Not a complex number: ${text}`);
  const re = m[1] === undefined ? 0 : Number(m[1]);
  const im = t.endsWith('i')
    ? (m[2] === '-' ? -1 : 1) * (m[3] === '' ? 1 : Number(m[3]))
    : 0;
  return { re, im };
}

const polynomials = fc
  .constantFrom(1, 2, 4, 8, 16)
  .chain((n) =>
    fc.array(fc.integer({ min: -99, max: 99 }), { minLength: n, maxLength: n }),
  );

describe('fft', () => {
  it('evaluates the example at the 8th roots of unity', () => {
    const { document } = runOk('fft', { coefficients: '1 2 3 4 0 0 0 0' });
    const values = stateOf(replay(document), 'T', 'table').data.map(
      (row) => row[1],
    );
    expect(values).toEqual(dft([1, 2, 3, 4, 0, 0, 0, 0]).map(showComplex));
    expect(values[0]).toBe('10');
  });

  it('agrees with the DFT summed directly, in n/2 lg n butterflies', () => {
    fc.assert(
      fc.property(polynomials, (a) => {
        const n = a.length;
        const { document } = runOk('fft', { coefficients: a });
        const trace = replay(document);
        const got = stateOf(trace, 'T', 'table').data.map((row) =>
          parseComplex(String(row[1])),
        );
        dft(a).forEach((y, k) => {
          expect(Math.abs(got[k]!.re - y.re), `re ${k}`).toBeLessThan(
            1e-3 + 1e-9,
          );
          expect(Math.abs(got[k]!.im - y.im), `im ${k}`).toBeLessThan(
            1e-3 + 1e-9,
          );
        });
        const ats = document.steps.map((s) => s.meta?.at);
        expect(ats.filter((x) => x === 'butterfly')).toHaveLength(
          (n / 2) * Math.log2(n),
        );
        // After the copy, A[rev(k)] holds a_k.
        const copied = stateOf(trace, 'T', 'table', 1).data.map(
          (row) => row[1],
        );
        a.forEach((ak, k) =>
          expect(copied[reverseBits(k, Math.log2(n))]).toBe(
            showComplex({ re: ak, im: 0 }),
          ),
        );
      }),
      fuzz,
    );
  });

  it('writes complex numbers to three decimals', () => {
    expect(showComplex({ re: 4, im: 0 })).toBe('4');
    expect(showComplex({ re: -1, im: 2.41421356 })).toBe('−1+2.414i');
    expect(showComplex({ re: 0, im: -1 })).toBe('−i');
    expect(showComplex({ re: 1e-12, im: -1e-12 })).toBe('0');
    expect(showComplex({ re: -0.0004, im: 0.70710678 })).toBe('0.707i');
    for (const z of [
      { re: -1, im: 2.414 },
      { re: 0, im: -1 },
      { re: 3.5, im: -0.25 },
    ])
      expect(parseComplex(showComplex(z))).toEqual(z);
  });

  it('refuses a length that is not a power of 2, and large coefficients', () => {
    expect(runError('fft', { coefficients: '1 2 3' }).message).toMatch(
      /power of 2/,
    );
    expect(
      runError('fft', { coefficients: Array<number>(32).fill(1) }).message,
    ).toMatch(/power of 2/);
    expect(runError('fft', { coefficients: '1 100' }).message).toMatch(/99/);
  });
});
