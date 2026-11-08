/**
 * A disjoint-set forest with union by rank and path compression, as in
 * CLRS (ADR 0023). `disjoint-set.find-set` follows parents to the root and
 * hangs every node on the way directly under it; `disjoint-set.union`
 * finds both roots and hangs the one of lower rank under the other,
 * raising the rank on a tie. A forest starts from `{ size, unions }`, the
 * unions replayed, or from `{ parent, rank }`, which `after` gives. Every
 * element of rank above 0 is annotated with it; a rank stops changing once
 * its element is no longer a root, as in CLRS.
 */
import type { TreeNode } from '@algoviz/spec';
import { z } from 'zod';

import type { Handle } from '../../recorder.ts';
import { listing } from '../../snippet.ts';
import {
  defineStructure,
  operationsOf,
  type Applied,
} from '../../structure.ts';
import {
  afterFirstStep,
  silentHandle,
  silentTrace,
  type Trace,
} from '../../trace.ts';
import { listField } from '../../notation/schema.ts';

/** Most elements a forest has, so it fits on one screen. */
export const MAX_ELEMENTS = 16;

export interface DisjointSetState {
  readonly parent: readonly number[];
  readonly rank: readonly number[];
  /** Each element's children, in the order they were hung under it. */
  readonly children: readonly (readonly number[])[];
}

type On = Handle<'tree'>;

const id = (x: number) => String(x);
const note = (on: On, x: number, rank: number) =>
  on.annotate({ node: id(x), text: `rank ${rank}` });

/** Moves x under p, in the model. */
function hang(s: DisjointSetState, x: number, p: number): DisjointSetState {
  const old = s.parent[x]!;
  return {
    ...s,
    parent: s.parent.map((q, k) => (k === x ? p : q)),
    children: s.children.map((c, k) =>
      k === p ? [...c, x] : k === old ? c.filter((y) => y !== x) : c,
    ),
  };
}

// FIND-SET and UNION share one listing, so a sequence shows each once.
const CODE = listing('sets', {
  pseudocode: `
    FIND-SET(x)
        if p[x] ≠ x  // @up
            p[x] = FIND-SET(p[x])  // @compress
        return p[x]  // @root

    UNION(x, y)
        a = FIND-SET(x)  // @find-x
        b = FIND-SET(y)  // @find-y
        if a == b
            return  // @same
        if rank[a] > rank[b]
            p[b] = a  // @hang-b
        else
            p[a] = b  // @hang-a
            if rank[a] == rank[b]
                rank[b] = rank[b] + 1  // @rank
  `,
  python: `
    def find_set(x):
        if parent[x] != x:  # @up
            parent[x] = find_set(parent[x])  # @compress
        return parent[x]  # @root

    def union(x, y):
        a = find_set(x)  # @find-x
        b = find_set(y)  # @find-y
        if a == b:
            return  # @same
        if rank[a] > rank[b]:
            parent[b] = a  # @hang-b
        else:
            parent[a] = b  # @hang-a
            if rank[a] == rank[b]:
                rank[b] += 1  # @rank
  `,
});

interface Found {
  readonly state: DisjointSetState;
  readonly root: number;
}

function findSet(s: DisjointSetState, x: number, trace: Trace, on: On): Found {
  const p = s.parent[x]!;
  if (p === x) {
    trace.step('root', `${x} is a root: it names the set.`, {
      vars: { x },
    });
    on.highlight({ nodes: [id(x)] });
    return { state: s, root: x };
  }
  trace.step('up', `${x} is not a root: find the root of its parent, ${p}.`, {
    vars: { x },
  });
  on.highlight({ nodes: [id(x)] });
  const found = findSet(s, p, trace, on);
  if (p === found.root) return found;
  trace.step(
    'compress',
    `Path compression: hang ${x} directly under the root ${found.root}.`,
    { vars: { x } },
  );
  on.setChild({ parent: id(found.root), child: id(x) });
  return { state: hang(found.state, x, found.root), root: found.root };
}

/** Throws unless x is an element of the forest. */
function checkElement(s: DisjointSetState, x: number): void {
  if (x >= s.parent.length)
    throw new RangeError(
      `${x} is not an element: the elements are 0 to ${s.parent.length - 1}`,
    );
}

/** Annotates the ranks, which a declaration cannot show. */
const ranked = (s: DisjointSetState, trace: Trace, on: On) =>
  afterFirstStep(trace, () =>
    s.rank.forEach((r, x) => {
      if (r > 0) note(on, x, r);
    }),
  );

function find(
  s: DisjointSetState,
  x: number,
  trace: Trace,
  on: On,
): Applied<DisjointSetState> {
  checkElement(s, x);
  const found = findSet(s, x, ranked(s, trace, on), on);
  return { state: found.state, result: found.root };
}

function union(
  s: DisjointSetState,
  x: number,
  y: number,
  trace: Trace,
  on: On,
): Applied<DisjointSetState> {
  checkElement(s, x);
  checkElement(s, y);
  const t = ranked(s, trace, on);
  t.step('find-x', `Find the root of ${x}.`, { vars: { x, y } });
  const fa = findSet(s, x, t, on);
  t.step('find-y', `Find the root of ${y}.`, { vars: { x, y } });
  const fb = findSet(fa.state, y, t, on);
  const [a, b] = [fa.root, fb.root];
  let state = fb.state;
  if (a === b) {
    t.step(
      'same',
      `${x} and ${y} are in the same set already, named ${a}: nothing to do.`,
    );
    return { state, result: null };
  }
  const [ra, rb] = [state.rank[a]!, state.rank[b]!];
  if (ra > rb) {
    t.step(
      'hang-b',
      `Root ${b} has the lower rank (${rb} < ${ra}): hang it under ${a}.`,
      { vars: { a, b } },
    );
    on.setChild({ parent: id(a), child: id(b) });
    return { state: hang(state, b, a), result: null };
  }
  t.step(
    'hang-a',
    ra === rb
      ? `Both roots have rank ${ra}: hang ${a} under ${b}.`
      : `Root ${a} has the lower rank (${ra} < ${rb}): hang it under ${b}.`,
    { vars: { a, b } },
  );
  on.setChild({ parent: id(b), child: id(a) });
  state = hang(state, a, b);
  if (ra === rb) {
    t.step('rank', `The rank of ${b} rises to ${rb + 1}.`, { vars: { a, b } });
    note(on, b, rb + 1);
    state = { ...state, rank: state.rank.map((r, k) => (k === b ? r + 1 : r)) };
  }
  return { state, result: null };
}

const Element = z
  .int()
  .min(0)
  .max(MAX_ELEMENTS - 1)
  .describe(`An element, from 0 to ${MAX_ELEMENTS - 1}.`);

const From = z.union(
  [
    z.strictObject({
      size: z
        .int()
        .min(1)
        .max(MAX_ELEMENTS)
        .describe('The number of elements n; each starts in a set of its own.'),
      unions: z
        .array(z.tuple([Element, Element]))
        .max(32)
        .optional()
        .describe('Pairs to unite first, e.g. [[0, 1], [2, 3]].'),
    }),
    z.strictObject({
      parent: listField(
        z
          .array(Element)
          .min(1)
          .max(MAX_ELEMENTS)
          .describe('The parent of each element; a root is its own parent.'),
        'number',
      ),
      rank: listField(
        z
          .array(z.int().min(0).max(MAX_ELEMENTS))
          .min(1)
          .max(MAX_ELEMENTS)
          .describe('The rank of each element.'),
        'number',
      ),
    }),
  ],
  {
    // A union reports only that no form matched; say what the forms are.
    error: (issue) =>
      issue.code === 'invalid_union'
        ? `from must be { size, unions } with 1 to ${MAX_ELEMENTS} elements, or { parent, rank } as after gives it`
        : undefined,
  },
);
type From = z.output<typeof From>;

const singletons = (n: number): DisjointSetState => ({
  parent: Array.from({ length: n }, (_, k) => k),
  rank: Array.from({ length: n }, () => 0),
  children: Array.from({ length: n }, () => []),
});

/** The forest `{ parent, rank }` describes, checked. */
function fromParents(parent: readonly number[], rank: readonly number[]) {
  const n = parent.length;
  if (rank.length !== n)
    throw new RangeError(`parent has ${n} entries but rank has ${rank.length}`);
  parent.forEach((p, x) => {
    if (p >= n)
      throw new RangeError(
        `The parent of ${x} is ${p}, which is not an element`,
      );
    // Ranks rise strictly towards the root, which also rules out cycles.
    if (p !== x && rank[x]! >= rank[p]!)
      throw new RangeError(
        `The rank of ${x} (${rank[x]}) must be below the rank of its parent ${p} (${rank[p]})`,
      );
  });
  // Union by rank gives a root of rank r at least 2^r elements.
  const root = (x: number): number => (parent[x] === x ? x : root(parent[x]!));
  const sizes = parent.map(
    (_, x) => parent.filter((_, y) => root(y) === x).length,
  );
  parent.forEach((p, x) => {
    if (p === x && 2 ** rank[x]! > sizes[x]!)
      throw new RangeError(
        `The root ${x} has rank ${rank[x]} but only ${sizes[x]} elements; a root of rank r has at least 2^r`,
      );
  });
  const s = singletons(n);
  return {
    parent: [...parent],
    rank: [...rank],
    children: s.children.map((_, x) =>
      parent.flatMap((p, y) => (p === x && y !== x ? [y] : [])),
    ),
  };
}

const op = operationsOf<DisjointSetState, From, 'tree'>();
const sample: From = {
  size: 6,
  unions: [
    [0, 1],
    [2, 3],
    [1, 3],
  ],
};

/** A disjoint-set forest. */
export const disjointSet = defineStructure<DisjointSetState, From, 'tree'>({
  id: 'disjoint-set',
  title: 'Disjoint-set forest',
  topic: 'trees',
  summary:
    'Unites sets and finds the set of an element in a disjoint-set forest, with union by rank and path compression.',
  name: 'sets',
  kind: 'tree',
  from: From.describe(
    'The starting forest: { size, unions }, or { parent, rank } as after gives it.',
  ),
  examples: [
    {
      from: { size: 6 },
      ops: [
        { op: 'union', x: 0, y: 1 },
        { op: 'union', x: 2, y: 3 },
        { op: 'union', x: 1, y: 3 },
        { op: 'union', x: 4, y: 5 },
        { op: 'find-set', x: 0 },
        { op: 'union', x: 5, y: 0 },
      ],
    },
  ],
  start(from) {
    if ('parent' in from) return fromParents(from.parent, from.rank);
    const trace = silentTrace();
    const on = silentHandle('tree');
    return (from.unions ?? []).reduce(
      (s, [x, y]) => union(s, x, y, trace, on).state,
      singletons(from.size),
    );
  },
  describe: (s) => ({ parent: [...s.parent], rank: [...s.rank] }),
  declare(s) {
    const nodes = s.parent.map((_, x): TreeNode => {
      const children = s.children[x]!.map(id);
      return children.length === 0
        ? { id: id(x), value: x }
        : { id: id(x), value: x, children };
    });
    const roots = s.parent.flatMap((p, x) => (p === x ? [id(x)] : []));
    return { kind: 'tree', nodes, roots };
  },
  clear: () => undefined,
  operations: [
    op({
      name: 'union',
      title: 'union',
      summary:
        'Unites the sets of two elements: finds both roots, then hangs the root of lower rank under the other.',
      args: {
        x: Element.describe('An element of the first set.'),
        y: Element.describe('An element of the second set.'),
      },
      examples: [
        {
          from: {
            size: 6,
            unions: [
              [0, 1],
              [2, 3],
            ],
          },
          x: 1,
          y: 3,
        },
      ],
      code: CODE,
      titleOf: ({ x, y }) => `union ${x} ${y}`,
      apply: (s, { x, y }, trace, on) => union(s, x, y, trace, on),
    }),
    op({
      name: 'find-set',
      title: 'find set',
      summary:
        'Finds the root that names the set of an element, then hangs every node on the way directly under it.',
      args: { x: Element.describe('The element whose set to find.') },
      examples: [{ from: sample, x: 0 }],
      code: CODE,
      titleOf: ({ x }) => `find set ${x}`,
      apply: (s, { x }, trace, on) => find(s, x, trace, on),
    }),
  ],
});
