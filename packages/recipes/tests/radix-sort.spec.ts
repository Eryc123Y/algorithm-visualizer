/**
 * Radix sort against independent references: after the pass on digit i,
 * a is in the order a stable sort by the last i digits gives (from
 * Array.prototype.sort, which is stable); at the end it is sorted.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Trace } from '@algoviz/core';
import type { VisualizationInput } from '@algoviz/spec';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';
import { recipe } from './recipe-properties.ts';

const valuesAt = (trace: Trace, name: string, frame?: number) =>
  stateOf(trace, name, 'array', frame).data.map((e) => e.value);

/** The frames right after each copy step. */
const afterCopies = (doc: VisualizationInput) =>
  doc.steps.flatMap((s, k) => (s.meta?.id === 'copy' ? [k + 1] : []));

function check(doc: VisualizationInput, values: readonly number[]): void {
  const trace = replay(doc);
  const d = String(Math.max(...values)).length;
  const frames = afterCopies(doc);
  expect(frames).toHaveLength(d);
  frames.forEach((frame, i) => {
    const m = 10 ** (i + 1);
    const expected = [...values].sort((x, y) => (x % m) - (y % m));
    expect(valuesAt(trace, 'a', frame)).toEqual(expected);
  });
  const a = stateOf(trace, 'a', 'array');
  expect(a.data.map((e) => e.value)).toEqual([...values].sort((x, y) => x - y));
  expect(a.marks.settled).toHaveLength(values.length);
  const counts = doc.steps.filter((s) => s.meta?.id === 'count');
  expect(counts).toHaveLength(d * values.length);
}

describe('radix-sort', () => {
  it('sorts CLRS’s example in three passes', () => {
    const values = [329, 457, 657, 839, 436, 720, 355];
    const doc = runOk('radix-sort', undefined).document;
    check(doc, values);
    const frames = afterCopies(doc);
    expect(valuesAt(replay(doc), 'a', frames[0])).toEqual([
      720, 355, 436, 457, 657, 329, 839,
    ]);
    expect(valuesAt(replay(doc), 'a', frames[1])).toEqual([
      720, 329, 436, 839, 355, 457, 657,
    ]);
  });

  it('keeps values with fewer digits, reading their missing digits as 0', () => {
    check(
      runOk('radix-sort', '7 1000 42 0 999').document,
      [7, 1000, 42, 0, 999],
    );
  });

  it('sorts random values on every digit stably', () => {
    fc.assert(
      fc.property(inputs, (values) =>
        check(runOk('radix-sort', { values }).document, values),
      ),
      fuzz,
    );
  });

  it('takes 1 to 16 integers from 0 to 9999', () => {
    for (const values of [[], Array.from({ length: 17 }, () => 1)])
      expect(runError('radix-sort', { values }).path).toBe('$.input.values');
    expect(runError('radix-sort', { values: [1, 10_000] }).path).toBe(
      '$.input.values[1]',
    );
    expect(runError('radix-sort', { values: [1, -1] }).path).toBe(
      '$.input.values[1]',
    );
    expect(runError('radix-sort', { values: [1.5] }).path).toBe(
      '$.input.values[0]',
    );
  });
});

const inputs = fc.oneof(
  fc.array(fc.integer({ min: 0, max: 9999 }), { minLength: 1, maxLength: 16 }),
  fc.array(fc.integer({ min: 0, max: 99 }), { minLength: 1, maxLength: 16 }),
  fc.array(fc.constantFrom(0, 10, 100, 101, 110), {
    minLength: 1,
    maxLength: 8,
  }),
);

recipe(
  'radix-sort',
  inputs,
  (values) => runOk('radix-sort', { values }).document,
  (trace, values) => check(trace.visualization, values),
);
