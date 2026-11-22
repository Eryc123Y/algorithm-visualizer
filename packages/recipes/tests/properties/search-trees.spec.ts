/**
 * Property tests of the recipes (recipe-properties.ts): Search trees: AVL, red-black, order-statistic, interval and B-trees.
 * Random inputs from each recipe's domain must give a document that loads,
 * ends with the right answer (checked against independent reference
 * implementations), lays out inside a fixed-size scene in every frame,
 * renders to clean SVG and runs the same in Chinese.
 *
 * Run bigger with e.g. `FUZZ_RUNS=2000 npx vitest run --project recipes
 * tests/properties/search-trees.spec.ts`.
 */
import fc from 'fast-check';
import { expect } from 'vitest';

import { runOk, stateOf } from '../helpers.ts';
import { recipe } from '../recipe-properties.ts';
import {
  drawnShape,
  RefTree,
  redBlackProblems,
} from '../red-black-reference.ts';
import {
  smallInt,
  ascending,
  inorder,
  heights,
  avlRuns,
  redBlackRuns,
  intervals,
} from './shared.ts';

recipe(
  'avl',
  avlRuns,
  (input, locale) => runOk('avl', input, locale).document,
  (trace, { from, ops }) => {
    const tree = stateOf(trace, 'avl', 'tree');
    const all = [...from, ...ops.map((o) => o.key)];
    expect(inorder(tree)).toEqual(ascending([...new Set(all)]));
    expect(tree.data.roots).toHaveLength(1);
    const h = heights(tree);
    for (const node of tree.data.nodes) {
      const [l, r] = [0, 1].map((k) => {
        const c = node.children[k] ?? null;
        return c === null ? 0 : h.get(c)!;
      });
      expect(Math.abs(l! - r!)).toBeLessThanOrEqual(1);
      expect(tree.marks.notes[node.id]).toBe(`h=${h.get(node.id)}`);
    }
  },
);

recipe(
  'red-black-tree',
  redBlackRuns,
  (input, locale) => runOk('red-black-tree', input, locale).document,
  (trace, { from, ops }) => {
    const ref = new RefTree<number>((a, b) => a < b);
    for (const key of from) ref.insert(key);
    for (const { op, key } of ops)
      if (op === 'insert') ref.insert(key);
      else ref.delete(key);
    const tree = stateOf(trace, 'T', 'tree');
    expect(drawnShape(tree)).toEqual(ref.shape());
    expect(
      redBlackProblems(tree, (a, b) => (a as number) < (b as number)),
    ).toEqual([]);
    // Each operation ends with a red–black tree and no pointer left over.
    const sections = trace.visualization.sections ?? [];
    for (const { start } of sections.slice(1)) {
      const before = stateOf(trace, 'T', 'tree', start);
      expect(
        redBlackProblems(before, (a, b) => (a as number) < (b as number)),
      ).toEqual([]);
    }
    // The successor's pointer goes once it has moved up.
    expect(Object.keys(tree.marks.pointers)).not.toContain('y');
    // Every frame, also in the middle of a deletion, draws one search
    // tree: the moves of a step leave no stray root behind.
    for (let k = 0; k <= trace.length; k++) {
      const at = stateOf(trace, 'T', 'tree', k);
      expect(at.data.roots.length, `frame ${k}`).toBeLessThanOrEqual(1);
      const keys = inorder(at) as number[];
      expect(keys, `frame ${k}`).toEqual(ascending(keys));
    }
  },
);

recipe(
  'order-statistic-tree',
  fc
    .tuple(
      fc.uniqueArray(smallInt, { minLength: 1, maxLength: 24 }),
      fc.array(
        fc.oneof(
          fc.record({
            op: fc.constantFrom('insert', 'delete', 'rank'),
            key: smallInt,
          }),
          fc.record({ op: fc.constant('select'), i: fc.constant(1) }),
        ),
        { minLength: 1, maxLength: 8 },
      ),
    )
    // Keep the first key, so that every select of rank 1 has one to find.
    .map(([from, ops]) => ({
      from,
      ops: ops.map((o) =>
        o.op === 'delete' && o.key === from[0] ? { ...o, key: o.key + 101 } : o,
      ),
    })),
  (input, locale) => runOk('order-statistic-tree', input, locale).document,
  (trace, { from, ops }) => {
    const keys = new Set(from);
    for (const o of ops)
      if (o.op === 'insert') keys.add(o.key);
      else if (o.op === 'delete') keys.delete(o.key);
    expect(inorder(stateOf(trace, 'T', 'tree'))).toEqual(ascending([...keys]));
  },
);

recipe(
  'interval-tree',
  fc
    .tuple(
      fc.uniqueArray(intervals, { maxLength: 24, selector: (i) => i.join() }),
      fc.array(
        fc.record({
          op: fc.constantFrom('insert', 'delete', 'search'),
          interval: intervals,
        }),
        { minLength: 1, maxLength: 8 },
      ),
    )
    .map(([from, ops]) => ({ from, ops })),
  (input, locale) => runOk('interval-tree', input, locale).document,
  (trace, { from, ops }) => {
    const keys = new Map(from.map((i) => [i.join(), i]));
    for (const { op, interval } of ops)
      if (op === 'insert') keys.set(interval.join(), interval);
      else if (op === 'delete') keys.delete(interval.join());
    const sorted = [...keys.values()]
      .sort((a, b) => a[0] - b[0] || a[1] - b[1])
      .map(([a, b]) => `[${a},${b}]`);
    expect(inorder(stateOf(trace, 'T', 'tree'))).toEqual(sorted);
  },
);

recipe(
  'b-tree',
  fc.record({
    from: fc.record({
      t: fc.integer({ min: 2, max: 4 }),
      keys: fc.uniqueArray(fc.integer({ min: 0, max: 60 }), { maxLength: 24 }),
    }),
    ops: fc.array(
      fc.record({
        op: fc.constantFrom('insert', 'delete', 'search'),
        key: fc.integer({ min: 0, max: 60 }),
      }),
      { minLength: 1, maxLength: 8 },
    ),
  }),
  (input, locale) => runOk('b-tree', input, locale).document,
  (trace, { from, ops }) => {
    const keys = new Set(from.keys);
    for (const { op, key } of ops)
      if (op === 'insert') keys.add(key);
      else if (op === 'delete') keys.delete(key);
    // An inorder walk of the drawn B-tree gives the keys in order.
    const s = stateOf(trace, 'T', 'btree');
    const byId = new Map(s.data.nodes.map((n) => [n.id, n]));
    const walk = (id: string): unknown[] => {
      const n = byId.get(id)!;
      if (n.children.length === 0) return n.keys.map((k) => k.value);
      return n.children.flatMap((c, i) => [
        ...walk(c),
        ...(i < n.keys.length ? [n.keys[i]!.value] : []),
      ]);
    };
    expect(walk(s.data.root)).toEqual(ascending([...keys]));
  },
);
