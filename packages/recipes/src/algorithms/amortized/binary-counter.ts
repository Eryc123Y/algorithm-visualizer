/**
 * A binary counter, as in CLRS's amortized analysis: INCREMENT flips the
 * trailing 1s of A[0 : k − 1] to 0 and the next bit to 1. One increment
 * can flip all k bits, but n increments from 0 flip fewer than 2n bits in
 * all, since bit i flips once every 2ⁱ increments. With the potential
 * Φ = the number of 1s, each increment costs at most 2, amortized.
 *
 * The bits are a one-row table, A[k − 1] on the left as CLRS draws them,
 * a step per bit flipped. A table beside it has a row per increment: the
 * value, its cost in flips, the total so far, and Φ.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';

/** The widest counter and the most increments, so that a run stays short. */
export const MAX_BITS = 8;
export const MAX_INCREMENTS = 16;

export const binaryCounter = defineAlgorithm({
  id: 'binary-counter',
  title: 'Binary counter',
  topic: 'amortized',
  summary:
    'Increments a k-bit binary counter n times from 0, flipping bits one at a time, and keeps each increment’s cost, the total and the potential, the number of 1s.',
  input: z.strictObject({
    k: z
      .int()
      .min(1)
      .max(MAX_BITS)
      .describe(`The number of bits, 1 to ${MAX_BITS}.`),
    n: z
      .int()
      .min(1)
      .max(MAX_INCREMENTS)
      .describe(`How many increments, from 0, 1 to ${MAX_INCREMENTS}.`),
  }),
  examples: [{ k: 4, n: 8 }],
  code: {
    pseudocode: `
      INCREMENT(A, k)
          i = 0
          while i < k and A[i] == 1
              A[i] = 0  // @reset
              i = i + 1
          if i < k
              A[i] = 1  // @set
    `,
    python: `
      def increment(a):
          i = 0
          while i < len(a) and a[i] == 1:
              a[i] = 0  # @reset
              i += 1
          if i < len(a):
              a[i] = 1  # @set
    `,
  },
  run({ k, n }, trace) {
    const bits = Array.from({ length: k }, () => 0);
    // Bit i is drawn in column k − 1 − i, so that A[0] is on the right.
    const col = (i: number): [number, number] => [0, k - 1 - i];
    const A = trace.add('A', {
      kind: 'table',
      initial: [bits.map(() => 0)],
      rowLabels: ['A'],
      columnLabels: bits.map((_, c) => `A[${k - 1 - c}]`),
    });
    const ledger = trace.add('cost', {
      kind: 'table',
      label: 'each increment: value, flips, total, Φ',
      place: 'side',
      rows: n,
      columns: 4,
      rowLabels: Array.from({ length: n }, (_, t) => t + 1),
      columnLabels: ['value', 'cost', 'total', 'Φ'],
    });
    let total = 0;
    let value = 0;
    for (let t = 1; t <= n; t++) {
      let i = 0;
      let flips = 0;
      const record = (last: boolean) => {
        if (!last) return;
        total += flips;
        const ones = bits.filter((b) => b === 1).length;
        const row = t - 1;
        [value, flips, total, ones].forEach((v, c) =>
          ledger.set({ cell: [row, c], value: v }),
        );
        ledger.highlight({ cells: [0, 1, 2, 3].map((c) => [row, c]) });
      };
      while (i < k && bits[i] === 1) {
        bits[i] = 0;
        flips += 1;
        const wraps = i === k - 1;
        if (wraps) value = 0;
        trace.step(
          'reset',
          wraps
            ? `Increment ${t}: A[${i}] is 1, so it flips to 0 too. Every bit was 1: the counter wraps around to 0, after ${flips} flips.`
            : `Increment ${t}: A[${i}] is 1, so it flips to 0 and the carry moves on.`,
          { vars: { i } },
        );
        A.set({ cell: col(i), value: 0 }).highlight({ cells: [col(i)] });
        i += 1;
        record(wraps);
      }
      if (i < k) {
        bits[i] = 1;
        flips += 1;
        value += 1;
        trace.step(
          'set',
          `Increment ${t}: A[${i}] is 0, so it flips to 1. The counter reads ${value}, after ${flips === 1 ? '1 flip' : `${flips} flips`}.`,
          { vars: { i } },
        );
        A.set({ cell: col(i), value: 1 }).highlight({ cells: [col(i)] });
        record(true);
      }
    }
  },
});
