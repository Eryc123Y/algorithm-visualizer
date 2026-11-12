/**
 * The recursion tree of a divide-and-conquer recurrence, as in CLRS: each
 * node is a subproblem and holds what dividing and combining it costs; the
 * leaves are the subproblems of size 1, which cost T(1) = 1. Adding the
 * cost of each level gives T(n), and how the level costs change from the
 * root to the leaves says which term dominates.
 *
 * The tree grows a level per step, each node showing its cost, and a
 * table beside it holds each level's nodes, their size and cost.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import {
  formatRecurrence,
  power,
  recurrenceField,
  type Recurrence,
} from './recurrence.ts';

/** At most this many leaves, so that the tree fits a page. */
export const MAX_LEAVES = 32;

/** The deepest tree the module draws, in levels below the root. */
export const MAX_DEPTH = 5;

/** The depth of a tree for n, if n is a power of b. */
const depthOf = (n: number, b: number): number | undefined => {
  let depth = 0;
  for (let m = n; m > 1; m /= b, depth++) if (m % b !== 0) return undefined;
  return depth;
};

/** The default n: the largest power of b whose tree stays small. */
export function defaultSize({ a, b }: Recurrence): number {
  let n = b;
  while (
    n * b <= 64 &&
    depthOf(n * b, b)! <= 4 &&
    a ** depthOf(n * b, b)! <= 16
  )
    n *= b;
  return n;
}

const Input = z
  .strictObject({
    recurrence: recurrenceField,
    n: z
      .int()
      .min(2)
      .max(1024)
      .optional()
      .describe(
        'The size of the problem at the root, a power of b; by default the largest one whose tree has at most 16 leaves.',
      ),
  })
  .superRefine(({ recurrence, n }, ctx) => {
    if (n === undefined) return;
    const depth = depthOf(n, recurrence.b);
    if (depth === undefined || depth < 1)
      ctx.addIssue({
        code: 'custom',
        path: ['n'],
        message: `n must be a power of b = ${recurrence.b}, such as ${recurrence.b ** 2}, not ${n}`,
      });
    else if (depth > MAX_DEPTH || recurrence.a ** depth > MAX_LEAVES)
      ctx.addIssue({
        code: 'custom',
        path: ['n'],
        message:
          depth > MAX_DEPTH
            ? `With n = ${n} the tree is ${depth} levels deep; take a smaller n, so that it has at most ${MAX_DEPTH}`
            : `With n = ${n} the tree has ${recurrence.a ** depth} leaves; take a smaller n, so that it has at most ${MAX_LEAVES}`,
      });
  });

export const recursionTree = defineAlgorithm({
  id: 'recursion-tree',
  title: 'Recursion tree',
  topic: 'foundations',
  summary:
    'Draws the recursion tree of T(n) = a T(n/b) + f(n) a level at a time, adds the cost of each level, and finds which term dominates.',
  input: Input,
  main: 'recurrence',
  examples: [
    { recurrence: { a: 2, b: 2, d: 1 }, n: 8 },
    { recurrence: { a: 3, b: 4, d: 2 }, n: 16 },
    { recurrence: { a: 4, b: 2, d: 1 }, n: 4 },
  ],
  code: {
    pseudocode: `
      TREE-COST(n)
          if n == 1
              return 1  // @leaf
          cost = f(n)  // @cost
          for i = 1 to a
              cost = cost + TREE-COST(n / b)  // @split
          return cost  // @total
    `,
    python: `
      def tree_cost(n, a, b, f):
          if n == 1:
              return 1  # @leaf
          cost = f(n)  # @cost
          for _ in range(a):
              cost += tree_cost(n // b, a, b, f)  # @split
          return cost  # @total
    `,
  },
  run({ recurrence, n: given }, trace) {
    const { a, b, d } = recurrence;
    const n = given ?? defaultSize(recurrence);
    const depth = depthOf(n, b)!;
    const f = (m: number) => m ** d;
    const levels = Array.from({ length: depth + 1 }, (_, j) => {
      const size = n / b ** j;
      const nodes = a ** j;
      const each = j === depth ? 1 : f(size);
      return { size, nodes, each, total: nodes * each };
    });
    const tree = trace.add('tree', {
      kind: 'tree',
      label: formatRecurrence(recurrence),
    });
    const table = trace.add('levels', {
      kind: 'table',
      label: 'cost of each level',
      place: 'side',
      rows: depth + 2,
      columns: 4,
      rowLabels: [...levels.map((_, j) => `depth ${j}`), 'T(n)'],
      columnLabels: ['nodes', 'size', 'each', 'level'],
    });
    const fill = (j: number) => {
      const { nodes, size, each, total } = levels[j]!;
      [nodes, size, each, total].forEach((value, c) =>
        table.set({ cell: [j, c], value }),
      );
      table.highlight({ cells: [0, 1, 2, 3].map((c) => [j, c]) });
    };
    const idOf = (j: number, k: number) => `d${j}-${k}`;
    const grow = (j: number) => {
      const { each } = levels[j]!;
      const ids = Array.from({ length: a ** j }, (_, k) => idOf(j, k));
      ids.forEach((id, k) => {
        tree.addNode({
          node: { id, value: each },
          parent: j === 0 ? null : idOf(j - 1, Math.floor(k / a)),
        });
      });
      tree.highlight({ nodes: ids });
    };

    trace.step(
      'cost',
      `The root is the whole problem, of size n = ${n}. Dividing it and combining the answers costs f(${n}) = ${levels[0]!.each}.`,
      { vars: { n } },
    );
    grow(0);
    fill(0);
    for (let j = 1; j <= depth; j++) {
      const { size, nodes, each, total } = levels[j]!;
      const parents = levels[j - 1]!.nodes;
      const split =
        parents === 1
          ? `The node at depth ${j - 1} splits into ${count(a, 'subproblem')} of size ${size}`
          : `Each of the ${parents} nodes at depth ${j - 1} splits into ${a} subproblems of size ${size}`;
      trace.step(
        j === depth ? 'leaf' : 'split',
        j === depth
          ? `${split}. ${nodes === 1 ? 'It is a leaf, costing' : `These ${nodes} are leaves, each costing`} T(1) = 1: ${total} in all.`
          : `${split}: ${count(nodes, 'node')} at depth ${j}, ${nodes === 1 ? 'costing' : 'each costing'} f(${size}) = ${each}, ${total} in all.`,
        { vars: { n: size } },
      );
      grow(j);
      fill(j);
    }

    const sum = levels.reduce((s, l) => s + l.total, 0);
    trace.step(
      'total',
      `T(${n}) = ${levels.map((l) => l.total).join(' + ')} = ${sum}. ${growth(recurrence)}`,
      { vars: { n } },
    );
    table.set({ cell: [depth + 1, 3], value: sum });
    table.highlight({
      cells: levels.map((_, j) => [j, 3] as [number, number]),
    });
    table.settle({ cells: [[depth + 1, 3]] });
  },
});

/** How the level costs change, and the order of growth they give. */
export function growth({ a, b, d }: Recurrence): string {
  const top = b ** d;
  const ratio = fraction(a, top);
  if (a < top)
    return `Each level costs ${ratio} of the one above, so the root's f(n) dominates: T(n) = Θ(${power(d)}).`;
  if (a === top)
    return d === 0
      ? `Every level costs the same, 1, over log${sub(b)} n + 1 levels: T(n) = Θ(lg n).`
      : `Every level costs the same, ${power(d)}, over log${sub(b)} n + 1 levels: T(n) = Θ(${power(d)} lg n).`;
  return `Each level costs ${ratio} times the one above, so the leaves dominate: T(n) = Θ(${leafPower(a, b)}).`;
}

/** n^(log_b a), as an integer power when it is one. */
function leafPower(a: number, b: number): string {
  const exponent = Math.log(a) / Math.log(b);
  const whole = Math.round(exponent);
  return Math.abs(exponent - whole) < 1e-9
    ? power(whole)
    : `n^log${sub(b)}${a}, about n^${exponent.toFixed(2)}`;
}

/** "3 subproblems", "1 node". */
const count = (k: number, noun: string) => `${k} ${noun}${k === 1 ? '' : 's'}`;

/** p/q in lowest terms, or a whole number. */
function fraction(p: number, q: number): string {
  const gcd = (x: number, y: number): number => (y === 0 ? x : gcd(y, x % y));
  const g = gcd(p, q);
  return q / g === 1 ? String(p / g) : `${p / g}/${q / g}`;
}

const sub = (b: number) => '₀₁₂₃₄₅₆₇₈₉'[b]!;
