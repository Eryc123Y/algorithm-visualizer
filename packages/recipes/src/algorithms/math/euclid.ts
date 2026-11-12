/**
 * Euclid's algorithm and its extended form (CLRS 31.2). EUCLID(a, b)
 * rests on gcd(a, b) = gcd(b, a mod b) and stops when b is 0.
 * EXTENDED-EUCLID also returns integers x and y with d = ax + by: from the
 * call below, which gives d = bx' + (a mod b)y', it takes x = y' and
 * y = x' − ⌊a/b⌋y'.
 *
 * Each call is a row of a table, as in CLRS's figure of the extended
 * algorithm: a, b and ⌊a/b⌋ are written on the way down, d, x and y on the
 * way back up.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';

/** Largest operand: at most 45 calls, the rows of one table. */
export const MAX_EUCLID = 1_000_000_000;

const Operand = z
  .int()
  .min(0)
  .max(MAX_EUCLID)
  .describe(`A whole number from 0 to ${MAX_EUCLID.toLocaleString('en')}.`);

const Input = z
  .strictObject({ a: Operand, b: Operand })
  .refine(({ a, b }) => a > 0 || b > 0, {
    message: 'gcd(0, 0) is not defined: give a or b greater than 0',
    path: ['b'],
  });

const minus = (x: number) => (x < 0 ? `−${-x}` : String(x));

/** The calls EUCLID makes from (a, b), the last one with b = 0. */
export function calls(a: number, b: number): [number, number][] {
  const out: [number, number][] = [[a, b]];
  while (out.at(-1)![1] !== 0) {
    const [x, y] = out.at(-1)!;
    out.push([y, x % y]);
  }
  return out;
}

export const euclid = defineAlgorithm({
  id: 'euclid',
  title: 'Euclid’s algorithm',
  topic: 'math',
  summary:
    'Finds the greatest common divisor of two whole numbers by replacing (a, b) with (b, a mod b) until b is 0.',
  input: Input,
  examples: [{ a: 30, b: 21 }],
  code: {
    pseudocode: `
      EUCLID(a, b)
          if b = 0
              return a  // @base
          return EUCLID(b, a mod b)  // @call
    `,
    python: `
      def euclid(a, b):
          if b == 0:
              return a  # @base
          return euclid(b, a % b)  # @call
    `,
  },
  run(input, trace) {
    const rows = calls(input.a, input.b);
    const table = trace.add('calls', {
      kind: 'table',
      label: 'Calls',
      initial: rows.map(() => ['', '', '']),
      columnLabels: ['a', 'b', 'a mod b'],
    });
    rows.forEach(([a, b], k) => {
      if (b === 0) {
        trace.step(
          'base',
          `EUCLID(${a}, 0): b is 0, so the answer is a: gcd(${input.a}, ${input.b}) = ${a}.`,
          { vars: { a, b } },
        );
        table.set({ cell: [k, 0], value: a }).set({ cell: [k, 1], value: 0 });
        table.settle({
          cells: rows.map((_, i) => [i, 0] as [number, number]),
        });
        return;
      }
      trace.step(
        'call',
        `EUCLID(${a}, ${b}): b is not 0, so call EUCLID(${b}, ${a} mod ${b}) = EUCLID(${b}, ${a % b}), which has the same gcd.`,
        { vars: { a, b } },
      );
      table
        .set({ cell: [k, 0], value: a })
        .set({ cell: [k, 1], value: b })
        .set({ cell: [k, 2], value: a % b });
    });
    return { results: [rows.at(-1)![0]] };
  },
});

export const extendedEuclid = defineAlgorithm({
  id: 'extended-euclid',
  title: 'Extended Euclid',
  topic: 'math',
  summary:
    'Finds d = gcd(a, b) and integers x and y with d = ax + by, working back up from the last call of Euclid’s algorithm.',
  input: Input,
  examples: [{ a: 99, b: 78 }],
  code: {
    pseudocode: `
      EXTENDED-EUCLID(a, b)
          if b = 0
              return (a, 1, 0)  // @base
          (d', x', y') = EXTENDED-EUCLID(b, a mod b)  // @call
          (d, x, y) = (d', y', x' - ⌊a/b⌋ y')  // @return
          return (d, x, y)
    `,
    python: `
      def extended_euclid(a, b):
          if b == 0:
              return a, 1, 0  # @base
          d, x1, y1 = extended_euclid(b, a % b)  # @call
          return d, y1, x1 - (a // b) * y1  # @return
    `,
  },
  run(input, trace) {
    const rows = calls(input.a, input.b);
    const table = trace.add('calls', {
      kind: 'table',
      label: 'Calls',
      initial: rows.map(() => ['', '', '', '', '', '']),
      columnLabels: ['a', 'b', '⌊a/b⌋', 'd', 'x', 'y'],
    });
    rows.forEach(([a, b], k) => {
      if (b === 0) return;
      trace.step(
        'call',
        `EXTENDED-EUCLID(${a}, ${b}): b is not 0, so call EXTENDED-EUCLID(${b}, ${a} mod ${b}) = EXTENDED-EUCLID(${b}, ${a % b}), keeping ⌊${a}/${b}⌋ = ${Math.floor(a / b)} for the way back.`,
        { vars: { a, b } },
      );
      table
        .set({ cell: [k, 0], value: a })
        .set({ cell: [k, 1], value: b })
        .set({ cell: [k, 2], value: Math.floor(a / b) });
    });
    const last = rows.length - 1;
    const d = rows[last]![0];
    trace.step(
      'base',
      `EXTENDED-EUCLID(${d}, 0): b is 0, so return (d, x, y) = (${d}, 1, 0), since ${d} = ${d} · 1 + 0 · 0.`,
      { vars: { a: d, b: 0 } },
    );
    table
      .set({ cell: [last, 0], value: d })
      .set({ cell: [last, 1], value: 0 })
      .set({ cell: [last, 3], value: d })
      .set({ cell: [last, 4], value: 1 })
      .set({ cell: [last, 5], value: 0 });
    let [x, y] = [1, 0];
    for (let k = last - 1; k >= 0; k--) {
      const [a, b] = rows[k]!;
      const q = Math.floor(a / b);
      const [xp, yp] = [x, y];
      [x, y] = [yp, xp - q * yp];
      trace.step(
        'return',
        `Back in EXTENDED-EUCLID(${a}, ${b}): the call below gave x' = ${minus(xp)} and y' = ${minus(yp)}, so x = y' = ${minus(x)} and y = x' − ${q} · y' = ${minus(y)}: ${d} = ${a} · ${paren(x)} + ${b} · ${paren(y)}.`,
        { vars: { a, b } },
      );
      table
        .set({ cell: [k, 3], value: d })
        .set({ cell: [k, 4], value: x })
        .set({ cell: [k, 5], value: y })
        .depend({
          cell: [k, 5],
          // From x' and y' below; ⌊a/b⌋ is in the narration, as an arrow
          // from it would run through d and x.
          on: [
            [k + 1, 4],
            [k + 1, 5],
          ],
        });
    }
    return { results: [d, x, y] };
  },
});

/** A number in brackets when it is negative, for a sum. */
const paren = (x: number) => (x < 0 ? `(${minus(x)})` : String(x));
