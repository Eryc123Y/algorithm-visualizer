/**
 * Property tests of the recipes (recipe-properties.ts): Algebra, number theory and the remaining recipes.
 * Random inputs from each recipe's domain must give a document that loads,
 * ends with the right answer (checked against independent reference
 * implementations), lays out inside a fixed-size scene in every frame,
 * renders to clean SVG and runs the same in Chinese.
 *
 * Run bigger with e.g. `FUZZ_RUNS=2000 npx vitest run --project recipes
 * tests/properties/algebra.spec.ts`.
 */
import fc from 'fast-check';
import { expect } from 'vitest';

import { runOk, stateOf } from '../helpers.ts';
import { recipe } from '../recipe-properties.ts';
import { graphs, nonNegative, euclidPairs } from './shared.ts';

// LUP decomposition: small integer matrices, singular ones included.
recipe(
  'lup-decomposition',
  fc.integer({ min: 1, max: 4 }).chain((n) =>
    fc.array(
      fc.array(fc.integer({ min: -5, max: 5 }), {
        minLength: n,
        maxLength: n,
      }),
      { minLength: n, maxLength: n },
    ),
  ),
  (a, locale) => runOk('lup-decomposition', { a }, locale).document,
  (trace, a) => {
    // π stays a permutation of the rows.
    const pi = stateOf(trace, 'pi', 'table').data[0]!.map(Number);
    expect([...pi].sort((x, y) => x - y)).toEqual(
      Array.from({ length: a.length }, (_, i) => i + 1),
    );
  },
);

// FFT: coefficients of every allowed length.
recipe(
  'fft',
  fc.constantFrom(1, 2, 4, 8, 16).chain((n) =>
    fc.array(fc.integer({ min: -99, max: 99 }), {
      minLength: n,
      maxLength: n,
    }),
  ),
  (coefficients, locale) => runOk('fft', { coefficients }, locale).document,
  (trace, coefficients) => {
    // y_0 is the sum of the coefficients, a real number.
    const y0 = stateOf(trace, 'T', 'table').data[0]![1];
    const sum = coefficients.reduce((s, x) => s + x, 0);
    expect(String(y0).replace('−', '-')).toBe(String(sum));
  },
);

recipe(
  'euclid',
  euclidPairs,
  (input, locale) => runOk('euclid', input, locale).document,
  (trace, { a, b }) => {
    // The last call's a divides both operands.
    const rows = stateOf(trace, 'calls', 'table').data;
    const d = Number(rows.at(-1)![0]);
    expect(a % d).toBe(0);
    expect(b % d).toBe(0);
  },
);

recipe(
  'extended-euclid',
  euclidPairs,
  (input, locale) => runOk('extended-euclid', input, locale).document,
  (trace, { a, b }) => {
    // The first row holds d, x and y with d = ax + by.
    const [, , , d, x, y] = stateOf(trace, 'calls', 'table').data[0]!.map(
      Number,
    );
    expect(a * x! + b * y!).toBe(d);
  },
);

// Modular exponentiation: any base, exponent and modulus allowed.
recipe(
  'modular-exponentiation',
  fc.record({
    a: fc.integer({ min: 0, max: 1_000_000_000 }),
    b: fc.integer({ min: 0, max: 2 ** 31 - 1 }),
    n: fc.integer({ min: 1, max: 1_000_000_000 }),
  }),
  (input, locale) => runOk('modular-exponentiation', input, locale).document,
  (trace, { b, n }) => {
    // The last column has read all of b, and every d is below n.
    const [, c, d] = stateOf(trace, 'bits', 'table').data;
    expect(c!.at(-1)).toBe(b);
    for (const x of d!) expect(Number(x)).toBeLessThan(n);
  },
);

// Suffix array: texts over a few letters, so suffixes share prefixes.
recipe(
  'suffix-array',
  fc.string({
    unit: fc.constantFrom('a', 'b', 'n'),
    minLength: 1,
    maxLength: 16,
  }),
  (text, locale) => runOk('suffix-array', { text }, locale).document,
  (trace, text) => {
    // The suffix column is in increasing order.
    const suffixes = stateOf(trace, 'S', 'table').data.map((r) => String(r[1]));
    expect(suffixes).toEqual([...suffixes].sort());
    expect(suffixes).toHaveLength(text.length);
  },
);

// Approximate vertex cover: any graph.
recipe(
  'approx-vertex-cover',
  graphs(nonNegative, { minNodes: 1 }),
  (graph, locale) => runOk('approx-vertex-cover', { graph }, locale).document,
  (trace, g) => {
    // Every edge has an end in the cover, group 0.
    const groups = stateOf(trace, 'g', 'graph').marks.groups;
    for (const [a, b] of g.edges)
      expect(groups[a] === 0 || groups[b] === 0).toBe(true);
  },
);

// Approximate TSP tour: distinct points on a small grid.
recipe(
  'approx-tsp-tour',
  fc.uniqueArray(
    fc.tuple(fc.integer({ min: -9, max: 9 }), fc.integer({ min: -9, max: 9 })),
    { minLength: 2, maxLength: 10, selector: ([x, y]) => `${x} ${y}` },
  ),
  (points, locale) => runOk('approx-tsp-tour', { points }, locale).document,
  (trace, points) => {
    // Every point is numbered once, 1 to n.
    const notes = Object.values(stateOf(trace, 'g', 'graph').marks.notes).map(
      Number,
    );
    expect([...notes].sort((a, b) => a - b)).toEqual(
      points.map((_, k) => k + 1),
    );
  },
);

// Greedy set cover: small families over a few elements.
recipe(
  'greedy-set-cover',
  fc
    .array(fc.subarray(['a', 'b', 'c', 'd', 'e', 'f'], { minLength: 1 }), {
      minLength: 1,
      maxLength: 6,
    })
    .map((ms) => ms.map((m, k): [string, string[]] => [`S${k}`, m])),
  (subsets, locale) => runOk('greedy-set-cover', { subsets }, locale).document,
  (trace, subsets) => {
    // The ticked subsets cover every element.
    const rows = stateOf(trace, 'F', 'table').data;
    const last = rows[0]!.length - 1;
    const covered = new Set(
      subsets.flatMap(([, m], k) => (rows[k]![last] === '✓' ? m : [])),
    );
    expect(covered.size).toBe(new Set(subsets.flatMap(([, m]) => m)).size);
  },
);
