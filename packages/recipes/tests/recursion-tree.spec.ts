/**
 * The recursion tree against independent references: T(n) by evaluating
 * the recurrence recursively, the tree level by level by counting
 * subproblems, and the order of growth by the master theorem's three
 * cases, checked on known recurrences.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Trace } from '@algoviz/core';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';
import { recipe } from './recipe-properties.ts';

interface Parts {
  a: number;
  b: number;
  d: number;
}

/** T(n) = a T(n/b) + n^d, T(1) = 1, by recursion. */
const T = ({ a, b, d }: Parts, n: number): number =>
  n === 1 ? 1 : n ** d + a * T({ a, b, d }, n / b);

/** The node values at each depth, from the root's children's parents. */
function levels(trace: Trace): number[][] {
  const tree = stateOf(trace, 'tree', 'tree');
  const byId = new Map(tree.data.nodes.map((node) => [node.id, node]));
  const out: number[][] = [];
  let level = [...tree.data.roots];
  while (level.length > 0) {
    out.push(level.map((id) => byId.get(id)!.value as number));
    level = level.flatMap((id) =>
      byId.get(id)!.children.filter((c): c is string => c !== null),
    );
  }
  return out;
}

function check(trace: Trace, parts: Parts, n: number): void {
  const depth = Math.round(Math.log(n) / Math.log(parts.b));
  const drawn = levels(trace);
  expect(drawn).toHaveLength(depth + 1);
  drawn.forEach((values, j) => {
    expect(values).toHaveLength(parts.a ** j);
    const size = n / parts.b ** j;
    for (const v of values) expect(v).toBe(j === depth ? 1 : size ** parts.d);
  });
  const table = stateOf(trace, 'levels', 'table').data;
  expect(table[depth + 1]![3]).toBe(T(parts, n));
  drawn.forEach((values, j) =>
    expect(table[j]).toEqual([
      values.length,
      n / parts.b ** j,
      values[0],
      values.reduce((s, v) => s + v, 0),
    ]),
  );
}

const lastNarration = (input: unknown) => {
  const steps = runOk('recursion-tree', input).document.steps;
  return steps.at(-1)!.meta!.narration!;
};

describe('recursion-tree', () => {
  it('draws merge sort’s tree by default, with n = 8', () => {
    const trace = replay(runOk('recursion-tree', undefined).document);
    check(trace, { a: 2, b: 2, d: 1 }, 8);
    expect(lastNarration(undefined)).toContain('T(8) = 8 + 8 + 8 + 8 = 32');
  });

  it.each([
    ['T(n) = 2T(n/2) + n', 'Θ(n lg n)'],
    ['T(n) = 3T(n/4) + n^2', 'Θ(n²)'],
    ['T(n) = 4T(n/2) + n', 'Θ(n²)'],
    ['T(n) = 3T(n/2) + n', 'Θ(n^log₂3, about n^1.58)'],
    ['T(n) = T(n/2) + 1', 'Θ(lg n)'],
    ['T(n) = 2T(n/4) + 1', 'Θ(n^log₄2, about n^0.50)'],
    ['T(n) = 4T(n/2) + n^2', 'Θ(n² lg n)'],
    ['T(n) = 2T(n/2) + n³', 'Θ(n³)'],
  ])('finds that %s is %s, by the master theorem’s case', (text, order) => {
    expect(lastNarration(text)).toContain(`T(n) = ${order}.`);
  });

  it('matches the recurrence on random inputs', () => {
    fc.assert(
      fc.property(inputs, ({ recurrence, n }) => {
        check(
          replay(runOk('recursion-tree', { recurrence, n }).document),
          recurrence,
          n,
        );
      }),
      fuzz,
    );
  });

  it('picks a default n with at most 16 leaves and 4 levels', () => {
    for (let a = 1; a <= 4; a++)
      for (let b = 2; b <= 4; b++) {
        const doc = runOk('recursion-tree', {
          recurrence: { a, b, d: 1 },
        }).document;
        const tree = stateOf(replay(doc), 'tree', 'tree');
        const leaves = tree.data.nodes.filter((x) =>
          x.children.every((c) => c === null),
        );
        expect(leaves.length).toBeLessThanOrEqual(16);
        expect(doc.steps.length).toBeLessThanOrEqual(4 + 2);
      }
  });

  it('reads the recurrence as text, and points at what it cannot read', () => {
    expect(
      runError('recursion-tree', 'T(n) = 2T(n/2) + n log n'),
    ).toMatchObject({
      code: 'INVALID_NOTATION',
    });
    expect(
      runError('recursion-tree', 'T(n) = 2T(n/2) + n log n').message,
    ).toContain('not "n log n" (character 18)');
    expect(runError('recursion-tree', 'S(n) = 2S(n/2)').code).toBe(
      'INVALID_NOTATION',
    );
    expect(
      runError('recursion-tree', { recurrence: 'T(n) = 5T(n/2) + n' }).path,
    ).toBe('$.input.recurrence.a');
  });

  it('takes n as a power of b, with at most 32 leaves', () => {
    expect(
      runError('recursion-tree', { recurrence: 'T(n) = 2T(n/2) + n', n: 12 })
        .path,
    ).toBe('$.input.n');
    expect(
      runError('recursion-tree', { recurrence: 'T(n) = 4T(n/2) + n', n: 8 })
        .message,
    ).toContain('64 leaves');
  });
});

const inputs = fc
  .record({
    a: fc.integer({ min: 1, max: 4 }),
    b: fc.integer({ min: 2, max: 4 }),
    d: fc.integer({ min: 0, max: 3 }),
  })
  .chain((recurrence) => {
    const sizes: number[] = [];
    for (let k = 1; k <= 5 && recurrence.a ** k <= 32; k++)
      sizes.push(recurrence.b ** k);
    return fc.record({
      recurrence: fc.constant(recurrence),
      n: fc.constantFrom(...sizes),
    });
  });

recipe(
  'recursion-tree',
  inputs,
  (input) => runOk('recursion-tree', input).document,
  (trace, { recurrence, n }) => check(trace, recurrence, n),
);
