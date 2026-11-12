/**
 * Optimal BSTs against an independent reference: every binary search tree
 * on the keys (at most 132 for six keys), each costed by its definition,
 * the sum over keys and gaps of (depth + 1) times the probability. e[1, n]
 * must be the least of them, and the tree the run builds must cost that
 * much. Probabilities are compared in whole hundredths.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { TreeState } from '@algomotion/core';
import type { VisualizationInput } from '@algomotion/spec';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';
import { recipe } from './recipe-properties.ts';

type Tree = { root: number; left: Tree | null; right: Tree | null } | null;

/** Every BST on keys i..j. */
function trees(i: number, j: number): Tree[] {
  if (i > j) return [null];
  const out: Tree[] = [];
  for (let r = i; r <= j; r++)
    for (const left of trees(i, r - 1))
      for (const right of trees(r + 1, j)) out.push({ root: r, left, right });
  return out;
}

/** The expected search cost of a tree on keys i..j, in hundredths. */
function costOf(
  t: Tree,
  i: number,
  j: number,
  p: number[],
  q: number[],
  depth = 0,
): number {
  if (t === null) return (depth + 1) * q[i - 1]!;
  return (
    (depth + 1) * p[t.root]! +
    costOf(t.left, i, t.root - 1, p, q, depth + 1) +
    costOf(t.right, t.root + 1, j, p, q, depth + 1)
  );
}

const cents = (xs: readonly number[]) => xs.map((x) => Math.round(x * 100));

/** e(i, j) and the first best root, by recursion over the range, in hundredths. */
function solve(
  p: number[],
  q: number[],
  i: number,
  j: number,
): { e: number; root: number } {
  if (i > j) return { e: q[i - 1]!, root: 0 };
  let w = q[i - 1]!;
  for (let k = i; k <= j; k++) w += p[k]! + q[k]!;
  let best = { e: Infinity, root: 0 };
  for (let r = i; r <= j; r++) {
    const t = solve(p, q, i, r - 1).e + solve(p, q, r + 1, j).e + w;
    if (t < best.e) best = { e: t, root: r };
  }
  return best;
}

/** The drawn tree as a Tree, from its node ids k1..kn. */
function drawn(state: TreeState): Tree {
  const byId = new Map(state.data.nodes.map((nd) => [nd.id, nd]));
  const of = (id: string | null): Tree => {
    if (id === null) return null;
    const nd = byId.get(id)!;
    return {
      root: Number(id.slice(1)),
      left: of(nd.children[0] ?? null),
      right: of(nd.children[1] ?? null),
    };
  };
  return of(state.data.roots[0] ?? null);
}

function check(
  doc: VisualizationInput,
  pIn: readonly number[],
  qIn: readonly number[],
): void {
  const n = pIn.length;
  const p = [0, ...cents(pIn)];
  const q = cents(qIn);
  const least = Math.min(...trees(1, n).map((t) => costOf(t, 1, n, p, q)));
  const trace = replay(doc);
  const e = stateOf(trace, 'e', 'table').data;
  expect(Math.round(Number(e[0]![n]) * 100)).toBe(least);
  const root = stateOf(trace, 'root', 'table').data;
  for (let i = 1; i <= n + 1; i++)
    for (let j = i - 1; j <= n; j++) {
      const want = solve(p, q, i, j);
      expect(Math.round(Number(e[i - 1]![j]) * 100)).toBe(want.e);
      if (j >= i) expect(root[i - 1]![j - 1]).toBe(want.root);
    }
  const tree = drawn(stateOf(trace, 'tree', 'tree'));
  expect(costOf(tree, 1, n, p, q)).toBe(least);
  // An in-order walk of a BST on k1..kn gives 1..n.
  const walk = (t: Tree): number[] =>
    t === null ? [] : [...walk(t.left), t.root, ...walk(t.right)];
  expect(walk(tree)).toEqual(Array.from({ length: n }, (_, k) => k + 1));
}

describe('optimal-bst', () => {
  it('builds CLRS’s tree, of expected cost 2.75', () => {
    const p = [0.15, 0.1, 0.05, 0.1, 0.2];
    const q = [0.05, 0.1, 0.05, 0.05, 0.05, 0.1];
    const doc = runOk('optimal-bst', undefined).document;
    check(doc, p, q);
    const tree = drawn(stateOf(replay(doc), 'tree', 'tree'));
    expect(tree?.root).toBe(2);
    expect(stateOf(replay(doc), 'e', 'table').data[0]![5]).toBe('2.75');
  });

  it('breaks ties by the first root, as CLRS’s strict < does', () => {
    const doc = runOk('optimal-bst', {
      p: [0, 0, 0],
      q: [0, 0, 0, 0],
    }).document;
    // Every tree costs 0, so k1 is the root, with k2 and k3 to its right.
    expect(drawn(stateOf(replay(doc), 'tree', 'tree'))).toEqual({
      root: 1,
      left: null,
      right: {
        root: 2,
        left: null,
        right: { root: 3, left: null, right: null },
      },
    });
  });

  it('handles one key, and zero probabilities', () => {
    check(
      runOk('optimal-bst', { p: [0.5], q: [0.25, 0.25] }).document,
      [0.5],
      [0.25, 0.25],
    );
    check(
      runOk('optimal-bst', { p: [0, 0, 0], q: [0, 0, 0, 0] }).document,
      [0, 0, 0],
      [0, 0, 0, 0],
    );
  });

  it('matches every BST on random probabilities', () => {
    fc.assert(
      fc.property(inputs, ({ p, q }) =>
        check(runOk('optimal-bst', { p, q }).document, p, q),
      ),
      fuzz,
    );
  });

  it('takes probabilities with two decimals, and one more q than p', () => {
    expect(runError('optimal-bst', { p: [0.123], q: [0.5, 0.5] }).path).toBe(
      '$.input.p[0]',
    );
    expect(runError('optimal-bst', { p: [0.5], q: [0.5] }).path).toBe(
      '$.input.q',
    );
    expect(runError('optimal-bst', { p: [0.5], q: [0.5, 0.2, 0.1] }).path).toBe(
      '$.input.q',
    );
    expect(runError('optimal-bst', { p: [1.5], q: [0, 0] }).path).toBe(
      '$.input.p[0]',
    );
  });
});

const hundredth = fc.integer({ min: 0, max: 30 }).map((k) => k / 100);
const inputs = fc.integer({ min: 1, max: 6 }).chain((n) =>
  fc.record({
    p: fc.array(hundredth, { minLength: n, maxLength: n }),
    q: fc.array(hundredth, { minLength: n + 1, maxLength: n + 1 }),
  }),
);

recipe(
  'optimal-bst',
  inputs,
  ({ p, q }) => runOk('optimal-bst', { p, q }).document,
  (trace, { p, q }) => check(trace.visualization, p, q),
);
