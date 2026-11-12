/**
 * Modular exponentiation by repeated squaring (CLRS 31.6): a^b mod n,
 * reading the bits of b from the most significant. Before each bit,
 * d = a^c mod n, where c is the prefix of b read so far; a bit doubles c,
 * so d is squared, and a 1 bit adds 1 to c, so d is multiplied by a. When
 * every bit is read, c = b and d is the answer.
 *
 * A table holds a column per bit, as in CLRS's figure for 7^560 mod 561:
 * the bit, then c and d after it. Arithmetic is in BigInt, so d · d is
 * exact for every modulus allowed.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { thousands } from './thousands.ts';

/** Largest base and modulus. */
export const MAX_MODULUS = 1_000_000_000;
/** Largest exponent: at most 31 bits, a column each. */
export const MAX_EXPONENT = 2 ** 31 - 1;

export const modularExponentiation = defineAlgorithm({
  id: 'modular-exponentiation',
  title: 'Modular exponentiation',
  topic: 'math',
  summary:
    'Computes a^b mod n by repeated squaring, reading the bits of b from the most significant: square for every bit, and multiply by a for every 1.',
  input: z.strictObject({
    a: z
      .int()
      .min(0)
      .max(MAX_MODULUS)
      .describe(
        `The base, a whole number from 0 to ${thousands(MAX_MODULUS)}.`,
      ),
    b: z
      .int()
      .min(0)
      .max(MAX_EXPONENT)
      .describe(`The exponent, a whole number from 0 to 2^31 − 1.`),
    n: z
      .int()
      .min(1)
      .max(MAX_MODULUS)
      .describe(
        `The modulus, a whole number from 1 to ${thousands(MAX_MODULUS)}.`,
      ),
  }),
  examples: [{ a: 7, b: 560, n: 561 }],
  code: {
    pseudocode: `
      MODULAR-EXPONENTIATION(a, b, n)  // b has bits b_k … b_0
          c = 0
          d = 1  // @start
          for i = k downto 0
              c = 2c
              d = (d · d) mod n  // @square
              if b_i = 1
                  c = c + 1
                  d = (d · a) mod n  // @multiply
          return d  // @done
    `,
    python: `
      def modular_exponentiation(a, b, n):
          c, d = 0, 1  # @start
          for bit in bin(b)[2:]:
              c, d = 2 * c, d * d % n  # @square
              if bit == "1":
                  c, d = c + 1, d * a % n  # @multiply
          return d  # @done
    `,
  },
  run(input, trace) {
    const { a, b, n } = input;
    const bits = b.toString(2);
    const k = bits.length - 1;
    const table = trace.add('bits', {
      kind: 'table',
      label: `b = ${b} in binary`,
      initial: [
        [...bits].map(Number),
        [...bits].map(() => ''),
        [...bits].map(() => ''),
      ],
      rowLabels: ['b_i', 'c', 'd'],
      columnLabels: [...bits].map((_, j) => String(k - j)),
    });
    const [A, N] = [BigInt(a), BigInt(n)];
    let c = 0;
    let d = 1n;
    trace.step(
      'start',
      `Start with c = 0 and d = 1, since ${a}^0 = 1, then read the ${bits.length} bit${bits.length === 1 ? '' : 's'} of b = ${b}, ${bits}, from the left. After each bit, d = ${a}^c mod ${n}.`,
    );
    [...bits].forEach((bit, j) => {
      const i = k - j;
      const before = d;
      c *= 2;
      d = (d * d) % N;
      trace.step(
        'square',
        `Bit b_${i} = ${bit}. ${c === 0 ? 'Doubling c leaves it 0, and' : `Doubling c to ${c}`} squares d: (${before} · ${before}) mod ${n} = ${d}.`,
        { vars: { i } },
      );
      table
        .set({ cell: [1, j], value: c })
        .set({ cell: [2, j], value: String(d) })
        .highlight({ cells: [[0, j]] });
      if (bit === '1') {
        const squared = d;
        c += 1;
        d = (d * A) % N;
        trace.step(
          'multiply',
          `The bit is 1, so c becomes ${c} and d is multiplied by a: (${squared} · ${a}) mod ${n} = ${d}.`,
          { vars: { i } },
        );
        table
          .set({ cell: [1, j], value: c })
          .set({ cell: [2, j], value: String(d) });
      }
      table.settle({
        cells: [
          [1, j],
          [2, j],
        ],
      });
    });
    trace.step(
      'done',
      `Every bit is read, so c = b and ${a}^${b} mod ${n} = ${d}.`,
    );
    table.highlight({ cells: [[2, k]] });
    return { results: [Number(d)] };
  },
});
