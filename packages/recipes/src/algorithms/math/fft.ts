/**
 * The fast Fourier transform (CLRS 30.3), iteratively: the coefficients
 * a_0 … a_{n−1} of a polynomial A, n a power of 2, give its values
 * y_k = A(ω_n^k) at the complex nth roots of unity, ω_n = e^{2πi/n}, in
 * O(n lg n) time. The coefficients are first copied in bit-reversed order,
 * so that each stage s combines pairs of DFTs of size m/2 = 2^{s−1} into
 * DFTs of size m by butterflies: u + ω t and u − ω t.
 *
 * Values are complex and shown to three decimals.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { parseIn } from '../../notation/error.ts';
import { parseList } from '../../notation/list.ts';

/** Most coefficients: 16, 32 butterflies in 4 stages. */
export const MAX_FFT = 16;

const SIZES = [1, 2, 4, 8, 16];

export interface Complex {
  readonly re: number;
  readonly im: number;
}

const plus = (a: Complex, b: Complex): Complex => ({
  re: a.re + b.re,
  im: a.im + b.im,
});
const minus = (a: Complex, b: Complex): Complex => ({
  re: a.re - b.re,
  im: a.im - b.im,
});
const times = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});

/** e^{2πi k/m}. */
export const root = (k: number, m: number): Complex => ({
  re: Math.cos((2 * Math.PI * k) / m),
  im: Math.sin((2 * Math.PI * k) / m),
});

/** A number to three decimals, with a true minus sign. */
function decimal(x: number): string {
  const r = Math.round(x * 1000) / 1000;
  const text = String(Math.abs(r));
  return r < 0 ? `−${text}` : text;
}

/** As the figures write it: `4`, `−1+2.414i`, `0.707i`, `0`. */
export function showComplex(z: Complex): string {
  const re = Math.round(z.re * 1000) / 1000;
  const im = Math.round(z.im * 1000) / 1000;
  if (im === 0) return decimal(re === 0 ? 0 : re);
  const imText = `${Math.abs(im) === 1 ? '' : String(Math.abs(im))}i`;
  if (re === 0) return `${im < 0 ? '−' : ''}${imText}`;
  return `${decimal(re)}${im < 0 ? '−' : '+'}${imText}`;
}

/** The index with the lowest `bits` bits of k in reverse order. */
export const reverseBits = (k: number, bits: number) => {
  let r = 0;
  for (let b = 0; b < bits; b++) r = (r << 1) | ((k >> b) & 1);
  return r;
};

const Entry = z.int().min(-99).max(99);

const FORM = 'integers separated by spaces or commas, e.g. "1 2 3 4"';

export const fft = defineAlgorithm({
  id: 'fft',
  title: 'Fast Fourier transform',
  topic: 'math',
  summary:
    'Evaluates a polynomial at the complex roots of unity, its discrete Fourier transform, in O(n lg n) time: the coefficients go in bit-reversed order, and each stage combines pairs of smaller transforms by butterflies.',
  input: z.strictObject({
    coefficients: z
      .union([
        z
          .string()
          .transform((s, ctx) =>
            parseIn(
              s,
              ctx,
              (t) => parseList(t, 'number', Entry),
              `Write ${FORM}.`,
            ),
          )
          .pipe(z.array(Entry)),
        z.array(Entry),
      ])
      .refine((a) => SIZES.includes(a.length), {
        message: `Give 1, 2, 4, 8 or 16 coefficients: n must be a power of 2, at most ${MAX_FFT}`,
      })
      .describe(
        `The coefficients a_0 … a_{n−1}, lowest degree first: ${FORM}, or an array; n is 1, 2, 4, 8 or 16, each from −99 to 99.`,
      ),
  }),
  main: 'coefficients',
  examples: [{ coefficients: [1, 2, 3, 4, 0, 0, 0, 0] }],
  code: {
    pseudocode: `
      ITERATIVE-FFT(a, n)
          let A[0 : n - 1] be a new array
          for k = 0 to n - 1
              A[rev(k)] = a_k  // @copy
          for s = 1 to lg n
              m = 2^s  // @stage
              ω_m = e^(2πi/m)
              for k = 0 to n - 1 by m
                  ω = 1
                  for j = 0 to m/2 - 1
                      t = ω A[k + j + m/2]  // @butterfly
                      u = A[k + j]
                      A[k + j] = u + t
                      A[k + j + m/2] = u - t
                      ω = ω ω_m
          return A  // @done
    `,
    python: `
      import cmath

      def iterative_fft(a):
          n = len(a)
          bits = n.bit_length() - 1
          A = [0] * n
          for k in range(n):
              r = int(f"{k:0{bits}b}"[::-1], 2) if bits else 0
              A[r] = a[k]  # @copy
          m = 2
          while m <= n:
              w_m = cmath.exp(2j * cmath.pi / m)  # @stage
              for k in range(0, n, m):
                  w = 1
                  for j in range(m // 2):
                      t = w * A[k + j + m // 2]  # @butterfly
                      u = A[k + j]
                      A[k + j] = u + t
                      A[k + j + m // 2] = u - t
                      w *= w_m
              m *= 2
          return A  # @done
    `,
  },
  run(input, trace) {
    const a = input.coefficients;
    const n = a.length;
    const bits = Math.log2(n);
    // A table, a row per index, so long complex values stay readable.
    const A: Complex[] = a.map(() => ({ re: 0, im: 0 }));
    const table = trace.add('T', {
      kind: 'table',
      label: 'a and A',
      initial: a.map((ak) => [String(ak), '']),
      rowLabels: a.map((_, k) => String(k)),
      columnLabels: ['a', 'A'],
    });
    trace.step(
      'copy',
      n === 1
        ? 'One coefficient: the transform of a constant is itself.'
        : `Copy each coefficient a_k to A[rev(k)], the index whose ${bits === 1 ? '1 bit is that of k, which reversed is itself' : `${bits} bits are those of k reversed`}: then each stage combines neighbouring blocks. Values are shown to three decimals.`,
    );
    for (let k = 0; k < n; k++) {
      const r = reverseBits(k, bits);
      A[r] = { re: a[k]!, im: 0 };
      table.set({ cell: [r, 1], value: showComplex(A[r]) });
    }

    for (let s = 1; s <= bits; s++) {
      const m = 2 ** s;
      const half = m / 2;
      trace.step(
        'stage',
        `Stage ${s}: combine each pair of neighbouring DFTs of size ${half} into one of size ${m}, with ω_${m} = e^(2πi/${m})${m <= 4 ? ` = ${showComplex(root(1, m))}` : ''}.`,
        { vars: { s, m } },
      );
      for (let k = 0; k < n; k += m)
        for (let j = 0; j < half; j++) {
          const w = root(j, m);
          const [lo, hi] = [k + j, k + j + half];
          const t = times(w, A[hi]!);
          const u = A[lo]!;
          A[lo] = plus(u, t);
          A[hi] = minus(u, t);
          trace.step(
            'butterfly',
            `Butterfly on A[${lo}] and A[${hi}] with ω = ω_${m}^${j} = ${showComplex(w)}: t = ω A[${hi}] = ${showComplex(t)} and u = A[${lo}] = ${showComplex(u)}, so A[${lo}] = u + t = ${showComplex(A[lo])} and A[${hi}] = u − t = ${showComplex(A[hi])}.`,
            { vars: { s, m, k, j } },
          );
          table
            .set({ cell: [lo, 1], value: showComplex(A[lo]) })
            .set({ cell: [hi, 1], value: showComplex(A[hi]) })
            .highlight({
              cells: [
                [lo, 1],
                [hi, 1],
              ],
            });
        }
    }
    trace.step(
      'done',
      `A holds the DFT: A[k] = y_k, the polynomial's value at ω_${n}^k, for k = 0 to ${n - 1}.`,
    );
    table.settle({ cells: a.map((_, k) => [k, 1] as [number, number]) });
    return {};
  },
});
