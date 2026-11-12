/**
 * The tree modules against independent references: a plain recursive AVL
 * tree, walks of a level order, prefix sets for tries, and label
 * propagation for disjoint sets. Structures also meet the checks of ADR
 * 0018: frame 0 is the starting state, `after` rebuilds it, and chained
 * runs end where one run ends. `properties.spec.ts` runs them on random
 * inputs.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { TreeState } from '@algomotion/core';
import type { VisualizationInput } from '@algomotion/spec';

import { fuzz, replay, runError, runOk, stateOf } from './helpers.ts';

/** A tree state as nested [value, left, right], for comparing shapes. */
type Shape = [unknown, Shape | null, Shape | null] | null;
function shapeOf(tree: TreeState): Shape {
  const byId = new Map(tree.data.nodes.map((n) => [n.id, n]));
  const of = (id: string | null): Shape => {
    if (id === null) return null;
    const n = byId.get(id)!;
    return [n.value, of(n.children[0] ?? null), of(n.children[1] ?? null)];
  };
  return of(tree.data.roots[0] ?? null);
}

const treeAt = (doc: VisualizationInput, name: string, frame?: number) =>
  stateOf(replay(doc), name, 'tree', frame);
const ids = (doc: VisualizationInput) => doc.steps.map((s) => s.meta?.id);

// ---------------------------------------------------------------------------
// AVL: a reference on mutable nodes, written the textbook way.

interface Ref {
  key: number;
  left: Ref | null;
  right: Ref | null;
  h: number;
}
const h = (n: Ref | null) => n?.h ?? 0;
const fix = (n: Ref) => (n.h = 1 + Math.max(h(n.left), h(n.right)));
function rotateLeft(x: Ref): Ref {
  const y = x.right!;
  x.right = y.left;
  y.left = x;
  fix(x);
  fix(y);
  return y;
}
function rotateRight(x: Ref): Ref {
  const y = x.left!;
  x.left = y.right;
  y.right = x;
  fix(x);
  fix(y);
  return y;
}
function avlInsert(n: Ref | null, key: number): Ref {
  if (n === null) return { key, left: null, right: null, h: 1 };
  if (key === n.key) return n;
  if (key < n.key) n.left = avlInsert(n.left, key);
  else n.right = avlInsert(n.right, key);
  fix(n);
  const b = h(n.left) - h(n.right);
  if (b > 1) {
    if (h(n.left!.left) < h(n.left!.right)) n.left = rotateLeft(n.left!);
    return rotateRight(n);
  }
  if (b < -1) {
    if (h(n.right!.right) < h(n.right!.left)) n.right = rotateRight(n.right!);
    return rotateLeft(n);
  }
  return n;
}
const refShape = (n: Ref | null): Shape =>
  n === null ? null : [n.key, refShape(n.left), refShape(n.right)];
const avlShape = (keys: readonly number[]) =>
  refShape(keys.reduce<Ref | null>((t, k) => avlInsert(t, k), null));

describe('avl', () => {
  it('rotates twice for a key that lands on the inner side', () => {
    const from = [10, 20, 30, 40, 50];
    const { document, after } = runOk('avl.insert', { from, key: 25 });
    expect(shapeOf(treeAt(document, 'avl', 0))).toEqual(avlShape(from));
    expect(shapeOf(treeAt(document, 'avl'))).toEqual(avlShape([...from, 25]));
    // 25 goes left of 30 under 40, so 20 leans right and 40 leans left.
    expect(ids(document)).toEqual([
      'go',
      'go',
      'go',
      'new',
      'height',
      'height',
      'height',
      'right-left',
      'rotate-left',
    ]);
    expect(after).toEqual([30, 20, 40, 10, 25, 50]);
  });

  it('rotates once for a key on the outer side', () => {
    const { document } = runOk('avl.insert', { from: [30, 20], key: 10 });
    expect(ids(document).at(-1)).toBe('rotate-right');
    expect(shapeOf(treeAt(document, 'avl'))).toEqual([
      20,
      [10, null, null],
      [30, null, null],
    ]);
  });

  it('annotates every node with its height from the first step', () => {
    const { document } = runOk('avl.insert', { from: [2, 1, 3], key: 4 });
    const first = treeAt(document, 'avl', 1);
    expect(Object.values(first.marks.notes).sort()).toEqual([
      'h=1',
      'h=1',
      'h=2',
    ]);
  });

  it('leaves the tree alone when it holds the key', () => {
    const run = runOk('avl.insert', { from: [2, 1, 3], key: 3 });
    expect(ids(run.document)).toEqual(['go', 'present']);
    expect(run.after).toEqual([2, 1, 3]);
  });

  it('matches the reference on random keys, and `after` rebuilds it', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -20, max: 20 }), { maxLength: 24 }),
        fc.array(fc.integer({ min: -20, max: 20 }), {
          minLength: 2,
          maxLength: 8,
        }),
        (from, more) => {
          const ops = more.map((key) => ({ op: 'insert', key }));
          const run = runOk('avl', { from, ops });
          const end = avlShape([...from, ...more]);
          expect(shapeOf(treeAt(run.document, 'avl'))).toEqual(end);
          // Level order rebuilds the same tree, without a rotation.
          const again = runOk('avl.insert', { from: run.after, key: 99 });
          expect(shapeOf(treeAt(again.document, 'avl', 0))).toEqual(end);
          const one = runOk('avl', { from, ops: ops.slice(0, 1) });
          const rest = runOk('avl', { from: one.after, ops: ops.slice(1) });
          expect(shapeOf(treeAt(rest.document, 'avl'))).toEqual(end);
        },
      ),
      fuzz,
    );
  });

  it('holds at most 32 keys', () => {
    const from = Array.from({ length: 32 }, (_, k) => k);
    expect(runError('avl.insert', { from, key: 40 })).toMatchObject({
      code: 'INVALID_ARGUMENT',
      message: 'The tree is full: it holds at most 32 keys',
    });
    expect(runOk('avl.insert', { from, key: 5 }).results).toEqual([null]);
  });
});

// ---------------------------------------------------------------------------
// Tree walks

describe('tree walks', () => {
  const levelOrder = [4, 2, 6, 1, 3, null, 7];
  it.each([
    ['inorder', [1, 2, 3, 4, 6, 7]],
    ['preorder', [4, 2, 1, 3, 6, 7]],
    ['postorder', [1, 3, 2, 7, 6, 4]],
  ] as const)('%s', (order, expected) => {
    const { document } = runOk(`${order}-tree-walk`, { levelOrder });
    const out = stateOf(replay(document), 'out', 'array');
    expect(out.data.map((e) => e.value)).toEqual(expected);
    // One entry and one visit per node.
    expect(ids(document).filter((x) => x === 'enter')).toHaveLength(6);
    expect(ids(document).filter((x) => x === 'visit')).toHaveLength(6);
  });

  it('refuses an empty tree and a value with no parent', () => {
    expect(
      runError('inorder-tree-walk', { levelOrder: [null, 1] }),
    ).toMatchObject({
      code: 'INVALID_ARGUMENT',
      message: 'The tree is empty: its root is null',
    });
    expect(
      runError('inorder-tree-walk', { levelOrder: [1, null, null, 2] }),
    ).toMatchObject({ code: 'INVALID_ARGUMENT' });
  });
});

// ---------------------------------------------------------------------------
// Trie

/** The values on the path of each word, from the root's children down. */
function paths(trie: TreeState): string[] {
  const byId = new Map(trie.data.nodes.map((n) => [n.id, n]));
  const out: string[] = [];
  const walk = (id: string, prefix: string) => {
    const n = byId.get(id)!;
    const word = prefix + String(n.value);
    if (trie.marks.settled.includes(id)) out.push(word);
    for (const c of n.children) if (c !== null) walk(c, word);
  };
  walk('root', '');
  return out;
}

describe('trie', () => {
  const words = ['tea', 'ten', 'to', 'in', 'inn'];

  it('shares prefixes, keeps children in order and marks word ends', () => {
    const { document, after } = runOk('trie.insert', {
      from: words,
      word: 'tent',
    });
    const trie = treeAt(document, 'trie');
    expect(paths(trie)).toEqual(['in', 'inn', 'tea', 'ten', 'tent', 'to']);
    // Word ends are settled from the first step on.
    expect(paths(treeAt(document, 'trie', 1))).toEqual([...words].sort());
    expect(after).toEqual(['in', 'inn', 'tea', 'ten', 'tent', 'to']);
    expect(ids(document)).toEqual([
      'start',
      'follow',
      'follow',
      'follow',
      'add',
      'mark',
    ]);
  });

  it('tells a word from a prefix and from a missing path', () => {
    const results = (word: string) =>
      runOk('trie.search', { from: words, word }).results;
    expect(results('ten')).toEqual([true]);
    expect(results('te')).toEqual([false]);
    expect(results('tx')).toEqual([false]);
    expect(
      ids(runOk('trie.search', { from: words, word: 'tx' }).document),
    ).toEqual(['start', 'follow', 'missing']);
  });

  it('builds the same trie whatever the order of the words', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.stringMatching(/^[ab]{1,4}$/), { maxLength: 8 }),
        (ws) => {
          const run = runOk('trie.search', { from: ws, word: 'a' });
          const reversed = runOk('trie.search', {
            from: [...ws].reverse(),
            word: 'a',
          });
          expect(run.after).toEqual([...ws].sort());
          expect(paths(treeAt(reversed.document, 'trie', 1))).toEqual(
            paths(treeAt(run.document, 'trie', 1)),
          );
          expect(run.results).toEqual([ws.includes('a')]);
        },
      ),
      fuzz,
    );
  });

  it('holds at most 8 words of 1 to 16 characters', () => {
    const eight = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    expect(runError('trie.insert', { from: eight, word: 'i' })).toMatchObject({
      code: 'INVALID_ARGUMENT',
      message: 'The trie is full: it holds at most 8 words',
    });
    expect(runOk('trie.insert', { from: eight, word: 'a' }).after).toEqual(
      eight,
    );
    for (const word of ['', 'x'.repeat(17)])
      expect(runError('trie.insert', { from: [], word }).path).toBe(
        '$.input.word',
      );
  });
});

// ---------------------------------------------------------------------------
// Disjoint sets

const forestAt = (doc: VisualizationInput, frame?: number) =>
  treeAt(doc, 'sets', frame);
/** Each element's parent in a forest state; roots are their own. */
function parentsOf(forest: TreeState): number[] {
  const parent = forest.data.nodes.map((n) => Number(n.id));
  for (const n of forest.data.nodes)
    for (const c of n.children)
      if (c !== null) parent[Number(c)] = Number(n.id);
  return parent;
}

describe('disjoint-set', () => {
  const from = {
    size: 6,
    unions: [
      [0, 1],
      [2, 3],
      [1, 3],
    ],
  };

  it('unites by rank: on a tie, the first root goes under the second', () => {
    // [0, 1]: 0 under 1; [2, 3]: 2 under 3; [1, 3]: 1 under 3, rank 2.
    const run = runOk('disjoint-set.find-set', { from, x: 5 });
    expect(run.after).toEqual({
      parent: [1, 3, 3, 3, 4, 5],
      rank: [0, 1, 0, 2, 0, 0],
    });
    expect(parentsOf(forestAt(run.document, 0))).toEqual([1, 3, 3, 3, 4, 5]);
  });

  it('finds the root and hangs the path under it', () => {
    const run = runOk('disjoint-set.find-set', { from, x: 0 });
    expect(run.results).toEqual([3]);
    expect(ids(run.document)).toEqual(['up', 'up', 'root', 'compress']);
    expect(parentsOf(forestAt(run.document))).toEqual([3, 3, 3, 3, 4, 5]);
    expect(run.after).toEqual({
      parent: [3, 3, 3, 3, 4, 5],
      rank: [0, 1, 0, 2, 0, 0],
    });
  });

  it('hangs the root of lower rank under the other, and raises a tied rank', () => {
    const lower = runOk('disjoint-set.union', { from, x: 4, y: 0 });
    expect(ids(lower.document).slice(-1)).toEqual(['hang-a']);
    expect(lower.after).toMatchObject({ parent: [3, 3, 3, 3, 3, 5] });
    const tie = runOk('disjoint-set.union', { from, x: 4, y: 5 });
    expect(ids(tie.document).slice(-2)).toEqual(['hang-a', 'rank']);
    expect(tie.after).toMatchObject({ rank: [0, 1, 0, 2, 0, 1] });
    const higher = runOk('disjoint-set.union', { from, x: 3, y: 4 });
    expect(ids(higher.document).at(-1)).toBe('hang-b');
    const same = runOk('disjoint-set.union', { from, x: 0, y: 2 });
    expect(ids(same.document).at(-1)).toBe('same');
  });

  it('annotates ranks above 0 from the first step', () => {
    const run = runOk('disjoint-set.find-set', { from, x: 4 });
    expect(forestAt(run.document, 1).marks.notes).toEqual({
      '1': 'rank 1',
      '3': 'rank 2',
    });
  });

  it('starts from { parent, rank } as after gives it, and checks it', () => {
    const run = runOk('disjoint-set.find-set', { from, x: 0 });
    const again = runOk('disjoint-set.find-set', { from: run.after, x: 0 });
    expect(again.after).toEqual(run.after);
    expect(ids(again.document)).toEqual(['up', 'root']);
    for (const [bad, message] of [
      [{ parent: [0, 0], rank: [0] }, 'parent has 2 entries but rank has 1'],
      [
        { parent: [0, 5], rank: [1, 0] },
        'The parent of 1 is 5, which is not an element',
      ],
      [
        { parent: [1, 0], rank: [0, 0] },
        'The rank of 0 (0) must be below the rank of its parent 1 (0)',
      ],
      [
        { parent: [0, 0], rank: [2, 0] },
        'The root 0 has rank 2 but only 2 elements; a root of rank r has at least 2^r',
      ],
    ] as const)
      expect(
        runError('disjoint-set.find-set', { from: bad, x: 0 }),
      ).toMatchObject({ code: 'INVALID_ARGUMENT', message });
    expect(
      runError('disjoint-set.union', { from: { size: 2 }, x: 0, y: 3 }),
    ).toMatchObject({
      code: 'INVALID_ARGUMENT',
      message: '3 is not an element: the elements are 0 to 1',
    });
    expect(runError('disjoint-set.find-set', { from: {}, x: 0 }).hint).toBe(
      'from must be { size, unions } with 1 to 16 elements, or { parent, rank } as after gives it',
    );
  });

  it('ends a chained run where one run ends', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }).chain((size) =>
          fc.tuple(
            fc.constant(size),
            fc.array(fc.tuple(fc.nat(size - 1), fc.nat(size - 1)), {
              minLength: 2,
              maxLength: 8,
            }),
          ),
        ),
        ([size, pairs]) => {
          const ops = pairs.map(([x, y]) => ({ op: 'union', x, y }));
          const run = runOk('disjoint-set', { from: { size }, ops });
          const one = runOk('disjoint-set', {
            from: { size },
            ops: ops.slice(0, 1),
          });
          const rest = runOk('disjoint-set', {
            from: one.after,
            ops: ops.slice(1),
          });
          expect(rest.after).toEqual(run.after);
          expect(parentsOf(forestAt(run.document))).toEqual(
            (run.after as { parent: number[] }).parent,
          );
        },
      ),
      fuzz,
    );
  });
});

// ---------------------------------------------------------------------------
// Whole lives, which the legacy bstInsert and binaryHeap showed

describe('whole lives as sequences', () => {
  it('inserts keys one by one into a BST, then searches', () => {
    const run = runOk('bst', {
      from: [],
      ops: [
        ...[5, 3, 8, 1, 4, 9, 7].map((key) => ({ op: 'insert', key })),
        { op: 'search', key: 4 },
      ],
    });
    expect(run.results.at(-1)).toBe(true);
    expect(run.after).toEqual([5, 3, 1, 4, 8, 7, 9]);
  });

  it('pushes values onto a min-heap, then pops them in order', () => {
    const run = runOk('min-heap', {
      from: [],
      ops: [
        ...[5, 3, 8, 1].map((value) => ({ op: 'push', value })),
        ...[1, 2, 3, 4].map(() => ({ op: 'pop' })),
      ],
    });
    expect(run.results.slice(4)).toEqual([1, 3, 5, 8]);
    expect(run.after).toEqual({ array: [] });
  });
});
