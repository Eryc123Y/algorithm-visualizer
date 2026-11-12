/**
 * Tasks for what Phase 2 and roadmap 1.8 added to the protocol: root lists
 * (ADR 0034), the `btree` kind (ADR 0035), list `move` (ADR 0036), array
 * patterns (ADR 0037), the `plane` kind (ADR 0038), and the priority queue
 * in the side panel (ADR 0029). Each check computes its answer with an
 * independent implementation and looks at states, not names.
 */
import type {
  ArrayPattern,
  BTreeState,
  PlaneState,
  PriorityQueueState,
  Trace,
  TreeState,
} from '@algomotion/core';

import {
  anyTrack,
  expect,
  graphIs,
  listOrder,
  maxGain,
  nums,
  same,
  selected,
  sortedNumbers,
  str,
  tracks,
  treeNode,
  values,
} from './checks.ts';
import type { EvalTask } from './tasks.ts';

/** Whether `want` appears in `got` in order, other entries between. */
const inOrder = <T>(want: readonly T[], got: readonly T[]): boolean => {
  let k = 0;
  for (const x of got) if (k < want.length && same(x, want[k])) k++;
  return k === want.length;
};

/** Consecutive repeats dropped. */
const runs = <T>(xs: readonly T[]): T[] =>
  xs.filter((x, i) => i === 0 || !same(x, xs[i - 1]));

// --- Fibonacci heap: root lists -------------------------------------------

/** The heap the task starts from: roots in order, with their subtrees. */
const FIB_ROOTS = [12, 5, 8, 30];
const FIB_KEYS = [12, 5, 9, 20, 14, 8, 11, 30];

const children = (s: TreeState, id: string) =>
  (treeNode(s, id)?.children ?? []).filter((c): c is string => c !== null);

const rootValues = (s: TreeState) =>
  nums(s.data.roots.map((id) => treeNode(s, id)?.value ?? null));

const heapOrdered = (s: TreeState) =>
  s.data.nodes.every((n) =>
    children(s, n.id).every(
      (c) => Number(treeNode(s, c)?.value) >= Number(n.value),
    ),
  );

function fibExtractMin(trace: Trace): string[] {
  return anyTrack(trace, 'tree', (t) => {
    const { first, last } = t;
    const degrees = last.data.roots.map((id) => children(last, id).length);
    const minRoot = last.data.roots.find(
      (id) => Number(treeNode(last, id)?.value) === 8,
    );
    return [
      ...expect(
        same(rootValues(first), FIB_ROOTS) &&
          same(
            sortedNumbers(nums(first.data.nodes.map((n) => n.value))),
            sortedNumbers(FIB_KEYS),
          ),
        `does not start with the root list ${FIB_ROOTS.join(', ')} and keys ${FIB_KEYS.join(', ')}`,
      ),
      ...expect(
        same(
          sortedNumbers(nums(last.data.nodes.map((n) => n.value))),
          sortedNumbers([...FIB_KEYS.filter((k) => k !== 5), 17]),
        ),
        'does not end with 17 in and 5 out',
      ),
      ...expect(
        t.states.some((s) => s.data.roots.length >= 6),
        "never moves 5's children to the root list",
      ),
      ...expect(
        new Set(degrees).size === degrees.length,
        `ends with roots of equal degree (${degrees.join(', ')}): not consolidated`,
      ),
      ...expect(heapOrdered(last), 'ends with a child smaller than its parent'),
      ...expect(
        minRoot !== undefined &&
          Object.values(last.marks.pointers).includes(minRoot),
        'does not end with a pointer at the new minimum, 8',
      ),
    ];
  });
}

// --- B-tree insertion -----------------------------------------------------

interface BNode {
  keys: number[];
  children: BNode[];
}

/**
 * The shape after inserting `keys` one by one into an empty B-tree of
 * minimum degree `t`, splitting full nodes on the way down.
 */
function bTreeAfter(keys: readonly number[], t: number): string {
  const full = (x: BNode) => x.keys.length === 2 * t - 1;
  const split = (x: BNode, i: number) => {
    const y = x.children[i]!;
    const z: BNode = {
      keys: y.keys.slice(t),
      children: y.children.slice(t),
    };
    x.keys.splice(i, 0, y.keys[t - 1]!);
    x.children.splice(i + 1, 0, z);
    y.keys = y.keys.slice(0, t - 1);
    y.children = y.children.slice(0, t);
  };
  const insertNonFull = (x: BNode, k: number): void => {
    let i = x.keys.filter((key) => key < k).length;
    if (x.children.length === 0) {
      x.keys.splice(i, 0, k);
      return;
    }
    if (full(x.children[i]!)) {
      split(x, i);
      if (k > x.keys[i]!) i++;
    }
    insertNonFull(x.children[i]!, k);
  };
  let root: BNode = { keys: [], children: [] };
  for (const k of keys) {
    if (full(root)) {
      root = { keys: [], children: [root] };
      split(root, 0);
    }
    insertNonFull(root, k);
  }
  const show = (x: BNode): string =>
    `[${x.keys.join(' ')}]` +
    (x.children.length === 0 ? '' : ` (${x.children.map(show).join(' ')})`);
  return show(root);
}

/** A btree state written as `[keys] (children)`, the form above. */
function bTreeShape(s: BTreeState): string {
  const byId = new Map(s.data.nodes.map((n) => [n.id, n]));
  const show = (id: string): string => {
    const n = byId.get(id);
    if (n === undefined) return '?';
    const keys = n.keys.map((k) => String(k.value)).join(' ');
    return n.children.length === 0
      ? `[${keys}]`
      : `[${keys}] (${n.children.map(show).join(' ')})`;
  };
  return show(s.data.root);
}

const keyCount = (s: BTreeState) =>
  s.data.nodes.reduce((sum, n) => sum + n.keys.length, 0);

const B_KEYS = [8, 3, 12, 5, 1, 9, 15, 7];

function bTreeInsert(trace: Trace): string[] {
  const want = bTreeAfter(B_KEYS, 2);
  return anyTrack(trace, 'btree', (t) => [
    ...expect(keyCount(t.first) === 0, 'does not start empty'),
    ...expect(
      bTreeShape(t.last) === want,
      `ends as ${bTreeShape(t.last)}, not ${want}`,
    ),
    ...expect(
      maxGain(t.states, keyCount) <= 1,
      'adds more than one key in a step',
    ),
    ...expect(
      t.states.every((s) => s.data.nodes.every((n) => n.keys.length <= 3)),
      'lets a node hold more than 2t − 1 = 3 keys',
    ),
  ]);
}

// --- Move-to-front: list `move` -------------------------------------------

const MTF_LIST = [3, 8, 5, 1, 6];
const MTF_REQUESTS = [5, 1, 5, 6];

/** The list before and after each request, the found key moved to the front. */
function moveToFrontOrders(
  list: readonly number[],
  requests: readonly number[],
) {
  const orders = [[...list]];
  for (const x of requests) {
    const prev = orders.at(-1)!;
    orders.push([x, ...prev.filter((y) => y !== x)]);
  }
  return runs(orders);
}

function moveToFront(trace: Trace): string[] {
  const want = moveToFrontOrders(MTF_LIST, MTF_REQUESTS);
  return anyTrack(trace, 'linkedList', (t) => {
    const got = runs(t.states.map((s) => nums(listOrder(s))));
    const ids = (s: typeof t.first) => s.data.map((n) => n.id).sort();
    return [
      ...expect(
        inOrder(want, got) && same(got.at(-1), want.at(-1)),
        `the list goes ${got.map((o) => o.join(' ')).join(' → ')}, not ${want.map((o) => o.join(' ')).join(' → ')}`,
      ),
      ...expect(
        same(ids(t.first), ids(t.last)),
        'replaces nodes instead of moving them',
      ),
    ];
  });
}

// --- KMP: array patterns --------------------------------------------------

const KMP_TEXT = 'abaabacababacab';
const KMP_PATTERN = 'abacab';

/** π[q]: the longest proper prefix of p[0..q] that is also its suffix. */
function prefixFunction(p: string): number[] {
  const pi = Array<number>(p.length).fill(0);
  for (let q = 1, k = 0; q < p.length; q++) {
    while (k > 0 && p[k] !== p[q]) k = pi[k - 1]!;
    if (p[k] === p[q]) k++;
    pi[q] = k;
  }
  return pi;
}

/** The shifts KMP compares the pattern at, in order, and the matches. */
function kmpShifts(text: string, p: string) {
  const pi = prefixFunction(p);
  const shifts: number[] = [];
  const found: number[] = [];
  let q = 0;
  for (let i = 0; i < text.length; i++) {
    shifts.push(i - q);
    while (q > 0 && p[q] !== text[i]) {
      q = pi[q - 1]!;
      shifts.push(i - q);
    }
    if (p[q] === text[i]) q++;
    if (q === p.length) {
      found.push(i - p.length + 1);
      q = pi[q - 1]!;
    }
  }
  return { shifts: runs(shifts), found };
}

function kmp(trace: Trace): string[] {
  const { shifts, found } = kmpShifts(KMP_TEXT, KMP_PATTERN);
  const pi = prefixFunction(KMP_PATTERN);
  const matching = anyTrack(trace, 'array', (t) => {
    const shown = t.states.flatMap((s) =>
      s.pattern === undefined ? [] : [s.pattern],
    );
    const got = runs(shown.map((p) => p.shift));
    // A match: every position known to match, or all but the last with
    // the last being compared, and equal.
    const m = KMP_PATTERN.length;
    const whole = (p: ArrayPattern) =>
      p.matched.length === m ||
      (p.matched.length === m - 1 &&
        p.compared === m - 1 &&
        KMP_TEXT[p.shift + m - 1] === KMP_PATTERN[m - 1]);
    const matches = [...new Set(shown.filter(whole).map((p) => p.shift))];
    return [
      ...expect(
        same(str(values(t.first)), [...KMP_TEXT]),
        `the text is ${str(values(t.first)).join('')}`,
      ),
      ...expect(
        shown.length > 0 &&
          same(str(shown[0]!.elements.map((e) => e.value)), [...KMP_PATTERN]),
        `does not align the pattern ${KMP_PATTERN} under the text`,
      ),
      ...expect(
        same(got.slice(0, shifts.length), shifts) &&
          got.slice(shifts.length).every((x) => x > shifts.at(-1)!),
        `moves the pattern through shifts ${got.join(', ')}, not ${shifts.join(', ')}`,
      ),
      ...expect(
        same(matches, found),
        `shows matches at ${matches.join(', ') || 'no shift'}, not ${found.join(', ')}`,
      ),
    ];
  });
  const prefix = anyTrack(trace, 'array', (t) =>
    expect(
      same(nums(values(t.last)), pi),
      `ends as ${JSON.stringify(values(t.last))}, not π = ${JSON.stringify(pi)}`,
    ),
  );
  return [...matching, ...prefix];
}

// --- Graham's scan: the plane ---------------------------------------------

const POINTS: readonly (readonly [number, number])[] = [
  [1, 0],
  [7, 2],
  [5, 3],
  [8, 6],
  [4, 5],
  [2, 8],
  [3, 3],
  [0, 4],
];

type Pt = readonly [number, number];
const cross = (o: Pt, a: Pt, b: Pt) =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const ptKey = ([x, y]: Pt) => `${x},${y}`;
const segKey = (a: Pt, b: Pt) => [ptKey(a), ptKey(b)].sort().join(' – ');

/** The hull's edges, by Andrew's monotone chain (not Graham's scan). */
function hullEdges(points: readonly Pt[]): string[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = (pts: readonly Pt[]) => {
    const out: Pt[] = [];
    for (const p of pts) {
      while (out.length >= 2 && cross(out.at(-2)!, out.at(-1)!, p) <= 0)
        out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  const hull = [...half(sorted), ...half([...sorted].reverse())];
  return hull.map((p, i) => segKey(p, hull[(i + 1) % hull.length]!)).sort();
}

const segments = (s: PlaneState) => {
  const at = new Map(s.data.points.map((p) => [p.id, [p.x, p.y] as const]));
  return s.data.segments.map((g) =>
    segKey(at.get(g.from) ?? [NaN, NaN], at.get(g.to) ?? [NaN, NaN]),
  );
};

function grahamScan(trace: Trace): string[] {
  const want = hullEdges(POINTS);
  const onHull = new Set(want.flatMap((e) => e.split(' – ')));
  return anyTrack(trace, 'plane', (t) => {
    const coords = (s: PlaneState) =>
      s.data.points.map((p) => ptKey([p.x, p.y])).sort();
    const got = [...new Set(segments(t.last))].sort();
    const popped = new Set(
      t.states
        .flatMap(segments)
        .filter((e) => !got.includes(e))
        .flatMap((e) => e.split(' – '))
        .filter((p) => !onHull.has(p)),
    );
    return [
      ...expect(
        same(coords(t.first), POINTS.map(ptKey).sort()),
        'does not start with the given points',
      ),
      ...expect(
        t.first.data.segments.length === 0,
        'starts with segments drawn',
      ),
      ...expect(
        same(got, want),
        `ends with segments ${got.join(', ')}, not the hull ${want.join(', ')}`,
      ),
      ...expect(
        popped.size > 0,
        'never draws a segment to an inner point and takes it back, as popping the stack does',
      ),
    ];
  });
}

// --- Prim's algorithm: the priority queue on the side ---------------------

const PRIM_EDGES: readonly (readonly [string, string, number])[] = [
  ['A', 'B', 6],
  ['A', 'C', 2],
  ['B', 'C', 7],
  ['B', 'D', 4],
  ['B', 'E', 9],
  ['C', 'E', 5],
  ['D', 'E', 8],
  ['D', 'F', 1],
  ['E', 'F', 3],
];

/** Prim's order of extraction from `root`, and the tree's edges. */
function primRun(edges: typeof PRIM_EDGES, root: string) {
  const nodes = [...new Set(edges.flatMap(([a, b]) => [a, b]))];
  const key = new Map(nodes.map((n) => [n, n === root ? 0 : Infinity]));
  const parent = new Map<string, string>();
  const order: string[] = [];
  while (order.length < nodes.length) {
    const u = nodes
      .filter((n) => !order.includes(n))
      .reduce((a, b) => (key.get(b)! < key.get(a)! ? b : a));
    order.push(u);
    for (const [a, b, w] of edges) {
      const v = a === u ? b : b === u ? a : undefined;
      if (v !== undefined && !order.includes(v) && w < key.get(v)!) {
        key.set(v, w);
        parent.set(v, u);
      }
    }
  }
  const tree = [...parent].map(([v, u]) => [u, v].sort().join('–')).sort();
  return { nodes, order, tree };
}

/** Item values in the order they leave the queue. */
function extractions(states: readonly PriorityQueueState[]): string[] {
  return states.slice(1).flatMap((s, k) => {
    // By value, so a key change drawn as remove and re-insert is no
    // extraction.
    const now = new Set(s.data.items.map((i) => String(i.value)));
    return states[k]!.data.items.map((i) => String(i.value)).filter(
      (v) => !now.has(v),
    );
  });
}

function primQueue(trace: Trace): string[] {
  const { nodes, order, tree } = primRun(PRIM_EDGES, 'A');
  const graph = anyTrack(trace, 'graph', (t) => {
    const got = selected(t.last)
      .map((e) => [e.from, e.to].sort().join('–'))
      .sort();
    return [
      ...graphIs(t, nodes, PRIM_EDGES, false),
      ...expect(
        same(got, tree),
        `ends with edges ${got.join(', ')} selected, not ${tree.join(', ')}`,
      ),
    ];
  });
  const side = tracks(trace, 'priorityQueue').filter(
    (q) => trace.visualization.structures[q.name]?.place === 'side',
  );
  const got = side.map((q) => extractions(q.states));
  const queue =
    side.length === 0
      ? ['no priority queue in the side panel']
      : expect(
          got.some((o) => same(o, order)),
          `extracts ${got[0]!.join(', ') || 'nothing'}, not ${order.join(', ')}`,
        );
  return [...graph, ...queue];
}

export const kindTasks: readonly EvalTask[] = [
  {
    id: 'fibonacci-extract-min',
    kinds: ['tree'],
    prompt:
      'A Fibonacci heap has the root list 12, 5, 8, 30, in that order. 5 has the children 9 (whose child 20 is marked) and 14; 8 has the child 11; 12 and 30 have none. Insert 17, then extract the minimum: move its children to the root list, consolidate the roots so that no two have the same degree, and point at the new minimum.',
    minSteps: 4,
    check: fibExtractMin,
  },
  {
    id: 'b-tree-insert',
    kinds: ['btree'],
    prompt: `Insert ${B_KEYS.join(', ')} in that order into an empty B-tree of minimum degree t = 2, splitting every full node on the way down as CLRS does. Show each key as it goes in, and each split.`,
    minSteps: B_KEYS.length,
    check: bTreeInsert,
  },
  {
    id: 'move-to-front',
    kinds: ['linkedList'],
    prompt: `A self-organizing linked list holds ${MTF_LIST.join(', ')}. Serve the requests ${MTF_REQUESTS.join(', ')} with the move-to-front rule: find each key from the head, then move its node to the front.`,
    minSteps: MTF_REQUESTS.length,
    check: moveToFront,
  },
  {
    id: 'kmp',
    kinds: ['array'],
    prompt: `Knuth–Morris–Pratt: compute the prefix function π of the pattern "${KMP_PATTERN}", then find every occurrence of it in the text "${KMP_TEXT}". Show the pattern sliding under the text and π as an array.`,
    minSteps: KMP_TEXT.length,
    check: kmp,
  },
  {
    id: 'graham-scan',
    kinds: ['plane'],
    prompt: `Graham's scan: the convex hull of the points ${POINTS.map(([x, y]) => `(${x}, ${y})`).join(', ')}. Draw the points in the plane, the segments between the points on the stack as they are pushed and popped, and close the hull at the end.`,
    minSteps: 6,
    check: grahamScan,
  },
  {
    id: 'prim-queue',
    kinds: ['graph', 'priorityQueue'],
    prompt: `Prim's minimum spanning tree from A on the undirected graph with edges ${PRIM_EDGES.map(([a, b, w]) => `${a}–${b} (${w})`).join(', ')}. Show the min-priority queue of vertices by key in the side panel, and mark the tree's edges.`,
    minSteps: 6,
    check: primQueue,
  },
];
