import { describe, expect, it } from 'vitest';

import type { TreeState } from '@algoviz/core';

import {
  avlInsert,
  balancedBrackets,
  binaryHeap,
  bstInsert,
  reverseLinkedList,
  treeTraversal,
  trieInsert,
  unionFind,
  type TraversalOrder,
} from '../src/index.ts';
import { randomInts, replay, stateOf } from './helpers.ts';

/** In-order sequence of a binary tree state. */
function inorder(tree: TreeState): unknown[] {
  const byId = new Map(tree.data.nodes.map((n) => [n.id, n]));
  const out: unknown[] = [];
  const walk = (id: string | null) => {
    if (id === null) return;
    const node = byId.get(id)!;
    walk(node.children[0] ?? null);
    out.push(node.value);
    walk(node.children[1] ?? null);
  };
  tree.data.roots.forEach(walk);
  return out;
}

function heights(tree: TreeState): Map<string, number> {
  const byId = new Map(tree.data.nodes.map((n) => [n.id, n]));
  const h = new Map<string, number>();
  const of = (id: string | null): number => {
    if (id === null) return 0;
    const node = byId.get(id)!;
    const value =
      1 + Math.max(of(node.children[0] ?? null), of(node.children[1] ?? null));
    h.set(id, value);
    return value;
  };
  tree.data.roots.forEach(of);
  return h;
}

describe('reverseLinkedList', () => {
  it.each([[[]], [[1]], [[1, 2, 3, 4]]])('reverses %j', (values) => {
    const trace = replay(reverseLinkedList(values));
    const list = stateOf(trace, 'list', 'linkedList');
    list.data.forEach((node, k) =>
      expect(node.next).toBe(k === 0 ? null : list.data[k - 1]!.id),
    );
    if (values.length > 0)
      expect(list.marks.pointers['head']).toBe(list.data.at(-1)!.id);
  });
});

describe('balancedBrackets', () => {
  const balanced = (s: string) => {
    const stack: string[] = [];
    const open: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
    for (const ch of s)
      if ('([{'.includes(ch)) stack.push(ch);
      else if (ch in open && stack.pop() !== open[ch]) return false;
    return stack.length === 0;
  };
  it.each(['', '()', '([]{})', '(]', '(()', '())', 'a(b)c', '{[()()]}'])(
    'decides %j',
    (text) => {
      const trace = replay(balancedBrackets(text));
      const last = trace.visualization.steps.at(-1)?.meta?.narration ?? '';
      expect(last.endsWith(': balanced.')).toBe(balanced(text));
    },
  );
});

describe('bstInsert', () => {
  it('keeps keys in order and finds what was inserted', () => {
    const keys = [8, 3, 10, 1, 6, 14, 4, 7, 13];
    const trace = replay(bstInsert(keys, 7));
    const tree = stateOf(trace, 'bst', 'tree');
    expect(inorder(tree)).toEqual([...keys].sort((a, b) => a - b));
    expect(tree.marks.settled).toEqual([`n${keys.indexOf(7)}`]);
  });
  it('reports a missing key', () => {
    const trace = replay(bstInsert([2, 1, 3], 5));
    expect(stateOf(trace, 'bst', 'tree').marks.settled).toEqual([]);
  });
});

describe('avlInsert', () => {
  it.each([
    [[1, 2, 3, 4, 5, 6, 7]],
    [[7, 6, 5, 4, 3, 2, 1]],
    [[10, 20, 15]],
    [[30, 10, 20]],
    [randomInts(7, 20, 50)],
  ])('stays balanced inserting %j', (keys) => {
    const trace = replay(avlInsert(keys));
    const tree = stateOf(trace, 'avl', 'tree');
    expect(inorder(tree)).toEqual([...new Set(keys)].sort((a, b) => a - b));
    const h = heights(tree);
    for (const node of tree.data.nodes) {
      const [l, r] = node.children.map((c) => (c === null ? 0 : h.get(c)!));
      expect(Math.abs(l! - r!)).toBeLessThanOrEqual(1);
      expect(tree.marks.notes[node.id]).toBe(`h=${h.get(node.id)}`);
    }
  });
});

describe('treeTraversal', () => {
  const shape = [1, 2, 3, 4, 5, null, 6];
  const expected: Record<TraversalOrder, number[]> = {
    preorder: [1, 2, 4, 5, 3, 6],
    inorder: [4, 2, 5, 1, 3, 6],
    postorder: [4, 5, 2, 6, 3, 1],
  };
  it.each(Object.entries(expected))('%s', (order, values) => {
    const trace = replay(treeTraversal(shape, order as TraversalOrder));
    const out = stateOf(trace, 'out', 'array');
    expect(out.data.map((e) => e.value)).toEqual(values);
    expect(stateOf(trace, 'tree', 'tree').marks.visited).toHaveLength(6);
  });
});

describe('binaryHeap', () => {
  it.each([[[5, 3, 8, 1, 9, 2]], [randomInts(3, 12, 30)], [[]]])(
    'extracts %j in order',
    (values) => {
      const trace = replay(binaryHeap(values));
      const out = stateOf(trace, 'out', 'array');
      expect(out.data.map((e) => e.value)).toEqual(
        [...values].sort((a, b) => a - b),
      );
      expect(stateOf(trace, 'heap', 'array').data).toEqual([]);
    },
  );
});

describe('trieInsert', () => {
  it('shares prefixes and marks word ends', () => {
    const words = ['tea', 'ten', 'to', 'inn', 'in', 'tea'];
    const trace = replay(trieInsert(words));
    const trie = stateOf(trace, 'trie', 'tree');
    const prefixes = new Set(
      words.flatMap((w) => [...w].map((_, k) => w.slice(0, k + 1))),
    );
    expect(trie.data.nodes).toHaveLength(prefixes.size + 1);
    expect(trie.marks.settled).toHaveLength(new Set(words).size);
    // Children are in alphabetical order.
    const byId = new Map(trie.data.nodes.map((n) => [n.id, n]));
    for (const node of trie.data.nodes) {
      const letters = node.children.map((c) => String(byId.get(c!)!.value));
      expect(letters).toEqual([...letters].sort());
    }
  });
});

describe('unionFind', () => {
  it('ends with one tree per connected component', () => {
    const unions = [
      [0, 1],
      [2, 3],
      [1, 3],
      [4, 5],
      [0, 2],
      [6, 6],
    ] as const;
    const trace = replay(unionFind(8, unions));
    const forest = stateOf(trace, 'sets', 'tree');
    const parent = new Map<string, string>();
    for (const n of forest.data.nodes)
      for (const c of n.children) if (c !== null) parent.set(c, n.id);
    const root = (id: string): string =>
      parent.has(id) ? root(parent.get(id)!) : id;
    const sets = new Map<string, string[]>();
    for (const n of forest.data.nodes)
      sets.set(root(n.id), [...(sets.get(root(n.id)) ?? []), n.id]);
    expect([...sets.values()].map((s) => s.sort()).sort()).toEqual(
      [['0', '1', '2', '3'], ['4', '5'], ['6'], ['7']].sort(),
    );
  });
});
