import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { TreeState } from '@algoviz/core';
import type { VisualizationInput } from '@algoviz/spec';

import { ops, type BstCall } from '../src/index.ts';
import { fuzz, replay, stateOf } from './helpers.ts';

/** A binary tree as nested keys, for comparing shapes. */
type Shape = {
  readonly key: unknown;
  readonly left: Shape;
  readonly right: Shape;
} | null;

/** The shape of the tree at `frame` (default the last). */
function shapeAt(doc: VisualizationInput, frame?: number): Shape {
  const trace = replay(doc);
  const tree: TreeState = stateOf(trace, 'bst', 'tree', frame);
  const byId = new Map(tree.data.nodes.map((n) => [n.id, n]));
  const build = (id: string | null | undefined): Shape => {
    if (id === null || id === undefined) return null;
    const n = byId.get(id)!;
    return {
      key: n.value,
      left: build(n.children[0]),
      right: build(n.children[1]),
    };
  };
  expect(tree.data.roots.length).toBeLessThanOrEqual(1);
  return build(tree.data.roots[0]);
}

// An independent reference: the textbook algorithms on immutable shapes.
const insert = (t: Shape, key: number): Shape =>
  t === null
    ? { key, left: null, right: null }
    : key < (t.key as number)
      ? { ...t, left: insert(t.left, key) }
      : { ...t, right: insert(t.right, key) };

const build = (keys: readonly number[]) => keys.reduce(insert, null as Shape);

const extreme = (t: Shape, side: 'left' | 'right'): number =>
  t![side] === null ? (t!.key as number) : extreme(t![side], side);

function remove(t: Shape, key: number, by: 'successor' | 'predecessor'): Shape {
  if (t === null) return null;
  const k = t.key as number;
  if (key < k) return { ...t, left: remove(t.left, key, by) };
  if (key > k) return { ...t, right: remove(t.right, key, by) };
  if (t.left === null) return t.right;
  if (t.right === null) return t.left;
  if (by === 'successor') {
    const s = extreme(t.right, 'left');
    return { ...t, key: s, right: remove(t.right, s, by) };
  }
  const p = extreme(t.left, 'right');
  return { ...t, key: p, left: remove(t.left, p, by) };
}

const contains = (t: Shape, key: number): boolean =>
  t !== null &&
  (t.key === key || contains(key < (t.key as number) ? t.left : t.right, key));

function reference(from: readonly number[], calls: readonly BstCall[]) {
  let t = build(from);
  const results = calls.map((c) => {
    if (c.op === 'search') return contains(t, c.key);
    if (c.op === 'insert') {
      t = insert(t, c.key);
      return null;
    }
    const found = contains(t, c.key);
    t = remove(t, c.key, c.replaceWith ?? 'successor');
    return found;
  });
  return { shape: t, results };
}

const from = [8, 3, 10, 1, 6, 14, 4, 7, 13];
const narrations = (doc: VisualizationInput) =>
  doc.steps.map((s) => s.meta?.narration ?? '');
/** The line a step's anchor names in one language of the document. */
const codeAt = (
  doc: VisualizationInput,
  at: string | undefined,
  language: string,
) => {
  const source = doc.sources!.find((s) => s.language === language)!;
  return source.code.split('\n')[source.anchors[at!]! - 1];
};

describe('ops.bst', () => {
  it('starts from the tree the keys build, without animating it', () => {
    const { document } = ops.bst.search({ from, key: 7 });
    expect(shapeAt(document, 0)).toEqual(build(from));
    expect(document.sections).toEqual([
      { id: 'search-7', title: 'Search 7', start: 0 },
    ]);
  });

  it('searches, pointing at each node on the path', () => {
    const found = ops.bst.search({ from, key: 7 });
    expect(found.results).toEqual([true]);
    expect(narrations(found.document)).toEqual([
      '7 < 8: go left.',
      '7 > 3: go right.',
      '7 > 6: go right.',
      'Found 7.',
    ]);
    const missing = ops.bst.search({ from, key: 5 });
    expect(missing.results).toEqual([false]);
    expect(narrations(missing.document).at(-1)).toBe(
      'Reached an empty spot: 5 is not in the tree.',
    );
    expect(shapeAt(missing.document)).toEqual(build(from));
  });

  it('inserts at the empty spot the search reaches', () => {
    const run = ops.bst.insert({ from, key: 5 });
    expect(shapeAt(run.document)).toEqual(build([...from, 5]));
    expect(narrations(run.document).at(-1)).toBe(
      'Empty spot: insert 5 as the right child of 4.',
    );
    expect(ops.bst.insert({ from: [], key: 5 }).document.steps).toHaveLength(1);
  });

  it.each([
    ['a leaf', 4],
    ['a node with one child', 10],
    ['a node with two children', 3],
    ['the root', 8],
    ['a missing key', 5],
  ])('deletes %s', (_, key) => {
    for (const replaceWith of ['successor', 'predecessor'] as const) {
      const run = ops.bst.delete({ from, key, replaceWith });
      const ref = reference(from, [{ op: 'delete', key, replaceWith }]);
      expect(shapeAt(run.document)).toEqual(ref.shape);
      expect(run.results).toEqual(ref.results);
    }
  });

  it('copies the successor into a node with two children by default', () => {
    const { document } = ops.bst.delete({ from, key: 3 });
    const copy = document.steps.find((s) =>
      s.meta?.narration?.startsWith('Copy'),
    )!;
    expect(copy.meta!.narration).toBe('Copy 4 into the node.');
    for (const language of ['pseudocode', 'python'])
      expect(codeAt(document, copy.meta!.at, language)).toContain(
        'node.key = succ.key',
      );
  });

  it('shows the code of each operation it runs, once', () => {
    const { document } = ops.bst.run({
      from,
      ops: [
        { op: 'search', key: 6 },
        { op: 'insert', key: 5 },
        { op: 'search', key: 5 },
      ],
    });
    const [pseudocode, python] = document.sources!.map((s) => s.code);
    expect(python!.match(/^def search/gm)).toHaveLength(1);
    expect(python!.match(/^def insert/gm)).toHaveLength(1);
    expect(python).not.toContain('def delete');
    expect(pseudocode!.match(/^TREE-SEARCH/gm)).toHaveLength(1);
    expect(pseudocode!.match(/^TREE-INSERT/gm)).toHaveLength(1);
    expect(pseudocode).not.toContain('TREE-DELETE');
    expect(document.title).toBe(
      'Binary search tree: search 6, insert 5, search 5',
    );
    // Anchors carry the operation's name, as several are joined.
    expect(document.steps.map((s) => s.meta?.at)).toContain('insert-go');
    for (const step of document.steps)
      for (const language of ['pseudocode', 'python'])
        expect(codeAt(document, step.meta?.at, language)).toBeDefined();
  });

  it('matches the reference on random operations, composed or chained', () => {
    const key = fc.integer({ min: 0, max: 20 });
    const call: fc.Arbitrary<BstCall> = fc.oneof(
      key.map((k) => ({ op: 'search' as const, key: k })),
      key.map((k) => ({ op: 'insert' as const, key: k })),
      key.map((k) => ({ op: 'delete' as const, key: k })),
    );
    fc.assert(
      fc.property(
        fc.array(key, { maxLength: 16 }),
        fc.array(call, { minLength: 2, maxLength: 6 }),
        (keys, calls) => {
          const run = ops.bst.run({ from: keys, ops: calls });
          const ref = reference(keys, calls);
          expect(shapeAt(run.document)).toEqual(ref.shape);
          expect(run.results).toEqual(ref.results);
          // One section per call, and every step named (ADR 0020).
          expect(run.document.sections).toHaveLength(calls.length);
          expect(run.document.steps.every((s) => s.meta?.id)).toBe(true);
          // `after` rebuilds the same tree.
          expect(build(run.after)).toEqual(ref.shape);
          // Two calls chained through `after` end where one call ends.
          const first = ops.bst.run({ from: keys, ops: calls.slice(0, 1) });
          const rest = ops.bst.run({ from: first.after, ops: calls.slice(1) });
          expect(shapeAt(rest.document)).toEqual(ref.shape);
          // The same input gives the same document.
          expect(ops.bst.run({ from: keys, ops: calls })).toEqual(run);
        },
      ),
      fuzz,
    );
  });

  it('deletes with the predecessor on random trees of distinct keys', () => {
    const key = fc.integer({ min: 0, max: 20 });
    fc.assert(
      fc.property(
        fc.uniqueArray(key, { maxLength: 16 }),
        fc.array(key, { minLength: 1, maxLength: 4 }),
        (keys, deletes) => {
          const calls = deletes.map((k) => ({
            op: 'delete' as const,
            key: k,
            replaceWith: 'predecessor' as const,
          }));
          const run = ops.bst.run({ from: keys, ops: calls });
          const ref = reference(keys, calls);
          expect(shapeAt(run.document)).toEqual(ref.shape);
          expect(run.results).toEqual(ref.results);
          expect(build(run.after)).toEqual(ref.shape);
        },
      ),
      fuzz,
    );
  });

  // With equal keys on the right, copying a predecessor that has an equal
  // key above it would leave that key on the left, breaking the tree.
  it('refuses the predecessor when its key appears twice', () => {
    expect(() =>
      ops.bst.delete({
        from: [3, 2, 2, 4],
        key: 3,
        replaceWith: 'predecessor',
      }),
    ).toThrow(
      'Replacing 3 by its predecessor needs distinct keys in its left subtree, but 2 appears 2 times; use the successor',
    );
    expect(ops.bst.delete({ from: [3, 2, 2, 4], key: 3 }).results).toEqual([
      true,
    ]);
  });

  // An equal key outside the left subtree is an ancestor, which the copy
  // keeps in order.
  it('allows the predecessor when its key also appears above', () => {
    const calls = [
      { op: 'delete', key: 7, replaceWith: 'predecessor' },
    ] as const;
    const run = ops.bst.run({ from: [5, 7, 5, 9], ops: calls });
    const ref = reference([5, 7, 5, 9], calls);
    expect(shapeAt(run.document)).toEqual(ref.shape);
    expect(run.results).toEqual([true]);
  });

  it('holds at most 32 keys, so `after` can always start the next call', () => {
    const keys = Array.from({ length: 31 }, (_, k) => k);
    const run = ops.bst.insert({ from: keys, key: 31 });
    expect(run.after).toHaveLength(32);
    expect(() => ops.bst.insert({ from: run.after, key: 32 })).toThrow(
      'The tree is full: it holds at most 32 keys',
    );
    expect(ops.bst.search({ from: run.after, key: 32 }).results).toEqual([
      false,
    ]);
  });

  it('rejects inputs it cannot show', () => {
    expect(() => ops.bst.run({ from, ops: [] })).toThrow(RangeError);
    const nine = Array.from({ length: 9 }, () => ({
      op: 'search' as const,
      key: 1,
    }));
    expect(() => ops.bst.run({ from, ops: nine })).toThrow(/at most 8/);
    expect(() => ops.bst.search({ from: [1, Number.NaN], key: 1 })).toThrow(
      RangeError,
    );
    expect(() => ops.bst.insert({ from, key: Infinity })).toThrow(RangeError);
    expect(() =>
      ops.bst.search({ from: Array.from({ length: 33 }, (_, k) => k), key: 1 }),
    ).toThrow(/at most 32/);
  });

  it('rejects operations its types do not allow, as JSON may hold them', () => {
    const zap = { op: 'zap', key: 1 } as unknown as BstCall;
    expect(() => ops.bst.run({ from, ops: [zap] })).toThrow(
      'Unknown operation "zap"; use search, insert or delete',
    );
    const sideways = {
      op: 'delete',
      key: 3,
      replaceWith: 'sideways',
    } as unknown as BstCall;
    expect(() => ops.bst.run({ from, ops: [sideways] })).toThrow(
      'replaceWith must be "successor" or "predecessor"',
    );
    const keys = { length: 2 } as unknown as number[];
    expect(() => ops.bst.search({ from: keys, key: 1 })).toThrow(
      'from must be an array',
    );
  });
});
