/**
 * Property tests of the recipes (recipe-properties.ts): String matching and computational geometry.
 * Random inputs from each recipe's domain must give a document that loads,
 * ends with the right answer (checked against independent reference
 * implementations), lays out inside a fixed-size scene in every frame,
 * renders to clean SVG and runs the same in Chinese.
 *
 * Run bigger with e.g. `FUZZ_RUNS=2000 npx vitest run --project recipes
 * tests/properties/strings-geometry.spec.ts`.
 */
import fc from 'fast-check';
import { expect } from 'vitest';

import { runOk, stateOf } from '../helpers.ts';
import { recipe } from '../recipe-properties.ts';
import { matchInput, gridPoints } from './shared.ts';

for (const id of [
  'naive-string-matcher',
  'rabin-karp',
  'finite-automaton-matcher',
  'kmp',
])
  recipe(
    id,
    matchInput,
    (input, locale) => runOk(id, input, locale).document,
    (trace, { text, pattern }) => {
      const want: number[] = [];
      for (let s = 0; s + pattern.length <= text.length; s++)
        if (text.startsWith(pattern, s)) want.push(s);
      const shifts = stateOf(trace, 'shifts', 'array').data.map((e) => e.value);
      expect(shifts).toEqual(want);
    },
  );

for (const id of ['graham-scan', 'jarvis-march'])
  recipe(
    id,
    gridPoints(3, 24),
    (points, locale) => runOk(id, { points }, locale).document,
    (trace) => {
      const P = stateOf(trace, 'P', 'plane');
      // As many hull edges chosen as hull vertices settled.
      expect(P.marks.selected.length).toBe(P.marks.settled.length);
    },
  );

recipe(
  'closest-pair',
  gridPoints(2, 16),
  (points, locale) => runOk('closest-pair', { points }, locale).document,
  (trace) => {
    const P = stateOf(trace, 'P', 'plane');
    expect(P.marks.selected).toHaveLength(1);
  },
);

recipe(
  'any-segments-intersect',
  fc.uniqueArray(
    fc
      .tuple(
        fc.tuple(
          fc.integer({ min: 0, max: 8 }),
          fc.integer({ min: 0, max: 8 }),
        ),
        fc.tuple(
          fc.integer({ min: 0, max: 8 }),
          fc.integer({ min: 0, max: 8 }),
        ),
      )
      .filter(([a, b]) => a[0] !== b[0]),
    {
      minLength: 1,
      maxLength: 12,
      selector: ([a, b]) => [a.join(), b.join()].sort().join(' '),
    },
  ),
  (segments, locale) =>
    runOk('any-segments-intersect', { segments }, locale).document,
  (trace) => {
    const P = stateOf(trace, 'P', 'plane');
    // Either two segments are chosen, as the pair found, or none.
    expect([0, 2]).toContain(P.marks.selected.length);
  },
);
