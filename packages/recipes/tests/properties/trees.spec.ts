/**
 * Property tests of the recipes (recipe-properties.ts): Fibonacci heaps, Huffman codes, tree walks, tries and disjoint sets.
 * Random inputs from each recipe's domain must give a document that loads,
 * ends with the right answer (checked against independent reference
 * implementations), lays out inside a fixed-size scene in every frame,
 * renders to clean SVG and runs the same in Chinese.
 *
 * Run bigger with e.g. `FUZZ_RUNS=2000 npx vitest run --project recipes
 * tests/properties/trees.spec.ts`.
 */
import fc from 'fast-check';
import { expect } from 'vitest';

import { runOk, stateOf } from '../helpers.ts';
import { recipe } from '../recipe-properties.ts';
import {
  valuesOf,
  heights,
  parents,
  levelOrders,
  traverse,
  trieRuns,
  disjointRuns,
} from './shared.ts';

recipe(
  'fibonacci-heap',
  fc
    .tuple(
      fc.uniqueArray(fc.integer({ min: 0, max: 60 }), { maxLength: 16 }),
      fc.array(
        fc.oneof(
          fc.record({
            op: fc.constant('insert'),
            key: fc.integer({ min: 61, max: 99 }),
          }),
          fc.record({ op: fc.constant('extract-min') }),
        ),
        { minLength: 1, maxLength: 8 },
      ),
    )
    // Distinct inserted keys, and no more extractions than keys.
    .map(([keys, raw]) => {
      let size = keys.length;
      const seen = new Set(keys);
      const ops = raw.filter((o) => {
        if (o.op === 'insert') {
          if (seen.has(o.key)) return false;
          seen.add(o.key);
          size++;
          return true;
        }
        if (size === 0) return false;
        size--;
        return true;
      });
      return {
        from: keys,
        ops: ops.length > 0 ? ops : [{ op: 'insert', key: 100 }],
      };
    }),
  (input, locale) => runOk('fibonacci-heap', input, locale).document,
  (trace, { from, ops }) => {
    const keys = new Set(from);
    for (const o of ops)
      if (o.op === 'insert') keys.add(o.key);
      else keys.delete(Math.min(...keys));
    const tree = stateOf(trace, 'H', 'tree');
    expect(
      tree.data.nodes.map((n) => n.value).sort((a, b) => Number(a) - Number(b)),
    ).toEqual([...keys].sort((a, b) => a - b));
  },
);

recipe(
  'huffman',
  fc
    .tuple(
      fc.uniqueArray(fc.constantFrom(...'abcdefghijklmnop'), {
        minLength: 2,
        maxLength: 16,
      }),
      fc.array(fc.integer({ min: 1, max: 99 }), {
        minLength: 16,
        maxLength: 16,
      }),
    )
    .map(([chars, freqs]) => ({
      frequencies: chars.map((c, k): [string, number] => [c, freqs[k]!]),
    })),
  (input, locale) => runOk('huffman', input, locale).document,
  (trace, { frequencies }) => {
    const codes = stateOf(trace, 'codes', 'table').data.map((row) => row[1]);
    expect(codes.every((c) => typeof c === 'string' && c.length > 0)).toBe(
      true,
    );
    expect(new Set(codes).size).toBe(frequencies.length);
  },
);

for (const order of ['preorder', 'inorder', 'postorder'] as const)
  recipe(
    `${order}-tree-walk`,
    levelOrders,
    (levelOrder, locale) =>
      runOk(`${order}-tree-walk`, { levelOrder }, locale).document,
    (trace, levelOrder) => {
      const expected = traverse(levelOrder, order);
      expect(valuesOf(trace, 'out')).toEqual(expected);
      const tree = stateOf(trace, 'tree', 'tree');
      expect(tree.marks.visited).toHaveLength(expected.length);
      expect(tree.marks.pointers).toEqual({});
    },
  );

recipe(
  'trie',
  trieRuns,
  (input, locale) => runOk('trie', input, locale).document,
  (trace, { from, ops }) => {
    const words = new Set(from);
    for (const { op, word } of ops) if (op === 'insert') words.add(word);
    const trie = stateOf(trace, 'trie', 'tree');
    const byId = new Map(trie.data.nodes.map((n) => [n.id, n]));
    const prefixes = new Set(
      [...words].flatMap((w) =>
        [...w].map((_, k) => [...w].slice(0, k + 1).join('\u0000')),
      ),
    );
    expect(trie.data.nodes).toHaveLength(prefixes.size + 1);
    expect(trie.data.roots).toEqual(['root']);
    const ends = new Set<string>();
    for (const word of words) {
      let at = 'root';
      for (const ch of word) {
        const next = byId
          .get(at)!
          .children.filter((c) => c !== null && byId.get(c)!.value === ch);
        expect(next, `child "${ch}" on the path of "${word}"`).toHaveLength(1);
        at = next[0]!;
      }
      ends.add(at);
    }
    expect([...trie.marks.settled].sort()).toEqual([...ends].sort());
    for (const node of trie.data.nodes) {
      const letters = node.children.map((c) => String(byId.get(c!)!.value));
      expect(letters).toEqual([...letters].sort());
    }
  },
);

recipe(
  'disjoint-set',
  disjointRuns,
  (input, locale) => runOk('disjoint-set', input, locale).document,
  (trace, { from: { size, unions }, ops }) => {
    const forest = stateOf(trace, 'sets', 'tree');
    const parent = parents(forest);
    const root = (id: string): string =>
      parent.has(id) ? root(parent.get(id)!) : id;
    // Reference: label propagation until nothing changes.
    const pairs = [
      ...unions,
      ...ops.flatMap((o) => (o.op === 'union' ? [[o.x, o.y] as const] : [])),
    ];
    const label = Array.from({ length: size }, (_, k) => k);
    for (let changed = true; changed;) {
      changed = false;
      for (const [a, b] of pairs) {
        const m = Math.min(label[a]!, label[b]!);
        for (const x of [a, b])
          if (label[x] !== m) {
            const old = label[x]!;
            for (let k = 0; k < size; k++) if (label[k] === old) label[k] = m;
            changed = true;
          }
      }
    }
    for (let a = 0; a < size; a++)
      for (let b = 0; b < size; b++)
        expect(root(String(a)) === root(String(b))).toBe(label[a] === label[b]);
    expect(forest.data.nodes).toHaveLength(size);
    // Union by rank: a node's rank bounds its height, and a root of rank r
    // has at least 2^r nodes.
    const rank = (id: string) =>
      Number(/^rank (\d+)$/.exec(forest.marks.notes[id] ?? '')?.[1] ?? 0);
    const h = heights(forest);
    const below = new Map<string, number>();
    for (const n of forest.data.nodes)
      below.set(root(n.id), (below.get(root(n.id)) ?? 0) + 1);
    for (const n of forest.data.nodes) {
      expect(h.get(n.id)! - 1, `height of ${n.id}`).toBeLessThanOrEqual(
        rank(n.id),
      );
      if (!parent.has(n.id))
        expect(below.get(n.id)!).toBeGreaterThanOrEqual(2 ** rank(n.id));
    }
  },
);
