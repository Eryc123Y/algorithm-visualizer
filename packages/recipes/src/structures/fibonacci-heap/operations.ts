/**
 * The Fibonacci heap's operations (ADR 0034), recorded step by step on the
 * heap `H`, a forest with a circular root list and the pointer `min` above
 * its root; on `A`, CONSOLIDATE's array of roots by degree, beside it; and
 * on `H2`, the second heap of a union, under it. A marked node has the
 * note `marked`; during CONSOLIDATE each root shows its degree.
 */
import type { Handle } from '../../recorder.ts';
import { MAX_SIZE } from '../../structure.ts';
import type { Steps } from '../red-black/engine.ts';
import {
  buildHeap,
  degree,
  findKey,
  keyText,
  maxDegree,
  minimumRoot,
  nodeOf,
  valueOf,
  withNode,
  type Entry,
  type FibHeap,
} from './model.ts';

/** A heap and how many unions have run, which names `H2`'s node ids. */
export interface FibState {
  readonly heap: FibHeap;
  readonly unions: number;
  /** Cells of A the last CONSOLIDATE wrote, which the next operation blanks. */
  readonly aCells: number;
}

export interface FibRun {
  readonly step: Steps;
  readonly on: Handle<'tree'>;
  readonly A?: Handle<'array'>;
  readonly H2?: Handle<'tree'>;
  /** Where a silent run records how many cells of A it needs. */
  readonly reach?: { cells: number };
}

const key = (h: FibHeap, id: string) => keyText(nodeOf(h, id).key);
const list = (items: readonly string[]) =>
  items.length < 2
    ? items.join('')
    : `${items.slice(0, -1).join(', ')} and ${items.at(-1)!}`;

const mark = (on: Handle<'tree'>, id: string, marked: boolean) =>
  on.annotate({ node: id, field: 'mark', text: marked ? 'marked' : null });

/** The marks and `min` of a heap, which a declaration cannot show. */
export function showHeap(on: Handle<'tree'>, h: FibHeap): void {
  for (const [id, n] of h.nodes) if (n.mark) mark(on, id, true);
  if (h.min !== null) on.pointer({ name: 'min', node: h.min });
}

/** Adds a heap's trees to a drawn forest, roots at the end, in preorder. */
function draw(on: Handle<'tree'>, h: FibHeap): void {
  const add = (id: string, parent: string | null) => {
    const n = nodeOf(h, id);
    on.addNode({ node: { id, value: valueOf(n.key) }, parent });
    if (n.mark) mark(on, id, true);
    for (const c of n.children) add(c, id);
  };
  for (const r of h.roots) add(r, null);
}

const insertAt = <T>(xs: readonly T[], at: number, x: T): T[] => [
  ...xs.slice(0, at),
  x,
  ...xs.slice(at),
];

/** FIB-HEAP-INSERT: a new root just left of `min`. */
export function insert(s: FibState, k: number, run: FibRun): FibState {
  const { on, step } = run;
  const h = s.heap;
  if (findKey(h, k) !== undefined)
    throw new RangeError(
      `The heap already holds ${keyText(k)}; keys are distinct`,
    );
  if (h.nodes.size >= MAX_SIZE)
    throw new RangeError(`The heap is full: it holds at most ${MAX_SIZE} keys`);
  const id = `n${h.next}`;
  const fresh = { key: k, children: [], parent: null, mark: false };
  const nodes = new Map(h.nodes).set(id, fresh);
  if (h.min === null) {
    step(
      'first',
      `The heap is empty: ${keyText(k)} becomes its only root, and its minimum.`,
    );
    on.addNode({ node: { id, value: valueOf(k) }, parent: null });
    on.pointer({ name: 'min', node: id });
    return { ...s, heap: { roots: [id], nodes, min: id, next: h.next + 1 } };
  }
  const at = h.roots.indexOf(h.min);
  step(
    'insert',
    `Put ${keyText(k)} in the root list as a tree of its own, just left of the minimum ${key(h, h.min)}.`,
  );
  on.addNode({ node: { id, value: valueOf(k) }, parent: null, slot: at });
  const heap = {
    ...h,
    roots: insertAt(h.roots, at, id),
    nodes,
    next: h.next + 1,
  };
  if (k < nodeOf(h, h.min).key) {
    step(
      'new-min',
      `${keyText(k)} < ${key(h, h.min)}: ${keyText(k)} is the new minimum.`,
    );
    on.pointer({ name: 'min', node: id });
    return { ...s, heap: { ...heap, min: id } };
  }
  return { ...s, heap };
}

/** The second heap of a union, with ids `m<k>-0`, `m<k>-1`, … */
export const secondHeap = (trees: readonly (Entry | number)[], k: number) =>
  buildHeap(trees, `m${k}-`);

/** FIB-HEAP-UNION: `H2`'s trees join `H`'s root list. */
export function union(
  s: FibState,
  trees: readonly (Entry | number)[],
  run: FibRun,
): FibState {
  const { on, step } = run;
  const H2 = run.H2;
  if (H2 === undefined) throw new Error('A union needs the structure H2');
  const h = s.heap;
  const other = secondHeap(trees, s.unions);
  for (const n of other.nodes.values())
    if (findKey(h, n.key) !== undefined)
      throw new RangeError(
        `Both heaps hold ${keyText(n.key)}; keys are distinct, so their union cannot`,
      );
  if (h.nodes.size + other.nodes.size > MAX_SIZE)
    throw new RangeError(
      `The union would hold ${h.nodes.size + other.nodes.size} keys; a heap holds at most ${MAX_SIZE}`,
    );
  step(
    'second',
    other.min === null
      ? 'The second heap H2 is empty.'
      : `The second heap H2 holds ${other.nodes.size} key${other.nodes.size === 1 ? '' : 's'}, its minimum ${key(other, other.min)}.`,
  );
  // The first union's heap is declared; a later one fills H2 again.
  if (s.unions > 0) draw(H2, other);
  showHeap(H2, other);
  step(
    'join',
    other.roots.length === 0
      ? 'Join H2’s root list to H’s: there is nothing to join.'
      : `Join H2’s root list to H’s: its trees, rooted at ${list(other.roots.map((r) => key(other, r)))}, follow H’s roots.`,
  );
  for (const r of other.roots) H2.removeNode({ node: r });
  draw(on, other);
  const nodes = new Map([...h.nodes, ...other.nodes]);
  let heap: FibHeap = { ...h, roots: [...h.roots, ...other.roots], nodes };
  if (
    other.min !== null &&
    (h.min === null || nodeOf(other, other.min).key < nodeOf(h, h.min).key)
  ) {
    step(
      'new-min',
      h.min === null
        ? `H was empty, so H2’s minimum ${key(other, other.min)} is the minimum.`
        : `H2’s minimum ${key(other, other.min)} < ${key(h, h.min)}: it is the new minimum.`,
    );
    on.pointer({ name: 'min', node: other.min });
    heap = { ...heap, min: other.min };
  }
  return { ...s, heap, unions: s.unions + 1 };
}

/** The root right of `id` in the circular root list. */
const rightOf = (roots: readonly string[], id: string) =>
  roots[(roots.indexOf(id) + 1) % roots.length]!;

/** FIB-HEAP-EXTRACT-MIN, with CONSOLIDATE. Returns the new state and the key. */
export function extractMin(
  s: FibState,
  run: FibRun,
): { state: FibState; key: number } {
  const { on, step } = run;
  let h = s.heap;
  const z = h.min;
  if (z === null)
    throw new RangeError('The heap is empty: there is no minimum to extract');
  const zk = key(h, z);
  const children = nodeOf(h, z).children;
  if (children.length > 0) {
    step(
      'children',
      `Move ${zk}’s children ${list(children.map((c) => key(h, c)))} to the root list, where ${zk} is.`,
    );
    const at = h.roots.indexOf(z);
    let roots = h.roots;
    children.forEach((c, k) => {
      on.detach({ node: c, slot: at + k });
      roots = insertAt(roots, at + k, c);
      h = withNode(h, c, { parent: null });
    });
    h = withNode({ ...h, roots }, z, { children: [] });
  }
  const left = h.roots.filter((r) => r !== z);
  const nodes = new Map(h.nodes);
  nodes.delete(z);
  if (left.length === 0) {
    step(
      'empty',
      `${zk} was the only node: take it out, and the heap is empty.`,
    );
    on.removeNode({ node: z });
    return {
      state: { ...s, heap: { ...h, roots: [], nodes, min: null } },
      key: nodeOf(s.heap, z).key,
    };
  }
  const next = rightOf(h.roots, z);
  step(
    'remove',
    `Take ${zk} out of the root list; for now min points at its right neighbour ${key(h, next)}.`,
  );
  on.removeNode({ node: z }).pointer({ name: 'min', node: next });
  h = { ...h, roots: left, nodes, min: next };
  // D(n) counts z too: CLRS decrements H.n after CONSOLIDATE.
  const done = consolidate(h, run, s.heap.nodes.size);
  return {
    state: { ...s, heap: done.heap, aCells: done.cells },
    key: nodeOf(s.heap, z).key,
  };
}

const showDegree = (on: Handle<'tree'>, id: string, d: number | null) =>
  on.annotate({ node: id, field: 'deg', text: d === null ? null : `d=${d}` });

/**
 * CONSOLIDATE: links roots of equal degree until no two are left. Returns
 * the heap and how many cells of A it used: D(n) + 1 for a heap the
 * operations built, more for a hand-written forest whose degrees break
 * the bound, which A is declared big enough for (see `auxiliary`).
 */
function consolidate(
  start: FibHeap,
  run: FibRun,
  n: number,
): { heap: FibHeap; cells: number } {
  const { on, step, A } = run;
  if (A === undefined) throw new Error('CONSOLIDATE needs the array A');
  let h = start;
  const D = maxDegree(n);
  step(
    'array',
    `Consolidate: start an array A with an empty entry for each degree up to D(${n}) = ${D}, and go through the roots.`,
  );
  const slots: (string | null)[] = [];
  let cells = D + 1;
  for (let d = 0; d <= D; d++) A.set({ index: d, value: '' });
  for (const r of h.roots) showDegree(on, r, degree(h, r));
  // Round the circular list once, starting at min, as CLRS does.
  const from = h.roots.indexOf(h.min!);
  const round = [...h.roots.slice(from), ...h.roots.slice(0, from)];
  for (const w of round) {
    let x = w;
    let d = degree(h, x);
    step('root', `Next root: ${key(h, x)}, of degree ${d}.`);
    on.pointer({ name: 'x', node: x }).highlight({ nodes: [x] });
    while ((slots[d] ?? null) !== null) {
      let y = slots[d]!;
      const same = `A[${d}] holds ${key(h, y)}, which also has degree ${d}`;
      if (nodeOf(h, x).key > nodeOf(h, y).key) [x, y] = [y, x];
      step(
        'link',
        `${same}: ${key(h, y)} > ${key(h, x)}, so ${key(h, y)} becomes a child of ${key(h, x)}${nodeOf(h, y).mark ? ' and loses its mark' : ''}, and ${key(h, x)} has degree ${d + 1}.`,
      );
      on.setChild({ parent: x, child: y });
      showDegree(on, y, null);
      if (nodeOf(h, y).mark) mark(on, y, false);
      showDegree(on, x, d + 1);
      on.pointer({ name: 'x', node: x });
      A.set({ index: d, value: '' });
      h = {
        ...h,
        roots: h.roots.filter((r) => r !== y),
        nodes: new Map(h.nodes)
          .set(y, { ...nodeOf(h, y), parent: x, mark: false })
          .set(x, { ...nodeOf(h, x), children: [...nodeOf(h, x).children, y] }),
      };
      slots[d] = null;
      d += 1;
    }
    step('store', `A[${d}] = ${key(h, x)}.`);
    A.set({ index: d, value: nodeOf(h, x).key }).highlight({ indices: [d] });
    slots[d] = x;
    cells = Math.max(cells, d + 1);
  }
  if (run.reach !== undefined)
    run.reach.cells = Math.max(run.reach.cells, cells);
  const order = slots.filter((r): r is string => r !== null && r !== undefined);
  h = { ...h, roots: order };
  const min = minimumRoot(h)!;
  step(
    'rebuild',
    `Rebuild the root list from A, in order: ${list(order.map((r) => key(h, r)))}. The least of them, ${key(h, min)}, is the minimum.`,
  );
  order.forEach((r, k) => {
    on.detach({ node: r, slot: k });
    showDegree(on, r, null);
  });
  on.pointer({ name: 'x', node: null }).pointer({ name: 'min', node: min });
  return { heap: { ...h, min }, cells };
}

/** CUT: `x` leaves its parent for the root list, just left of `min`. */
function cut(h: FibHeap, x: string, on: Handle<'tree'>): FibHeap {
  const p = nodeOf(h, x).parent!;
  const at = h.roots.indexOf(h.min!);
  on.detach({ node: x, slot: at });
  if (nodeOf(h, x).mark) mark(on, x, false);
  return {
    ...h,
    roots: insertAt(h.roots, at, x),
    nodes: new Map(h.nodes)
      .set(x, { ...nodeOf(h, x), parent: null, mark: false })
      .set(p, {
        ...nodeOf(h, p),
        children: nodeOf(h, p).children.filter((c) => c !== x),
      }),
  };
}

/** FIB-HEAP-DECREASE-KEY, with CUT and CASCADING-CUT. */
export function decreaseKey(
  s: FibState,
  k: number,
  to: number,
  run: FibRun,
): FibState {
  const { on, step } = run;
  let h = s.heap;
  const x = findKey(h, k);
  if (x === undefined)
    throw new RangeError(`The heap does not hold ${keyText(k)}`);
  if (!(to < k))
    throw new RangeError(
      `Decreasing ${keyText(k)} needs a smaller key, not ${keyText(to)}`,
    );
  const taken = findKey(h, to);
  if (taken !== undefined)
    throw new RangeError(
      `The heap already holds ${keyText(to)}; keys are distinct`,
    );
  h = withNode(h, x, { key: to });
  const p = nodeOf(h, x).parent;
  const order = p === null || nodeOf(h, p).key <= to;
  step(
    'decrease',
    p === null
      ? `Decrease ${keyText(k)} to ${keyText(to)}. It is a root, so no order breaks.`
      : order
        ? `Decrease ${keyText(k)} to ${keyText(to)}. Its parent ${key(h, p)} is still smaller, so nothing moves.`
        : `Decrease ${keyText(k)} to ${keyText(to)}, below its parent ${key(h, p)}: the heap order breaks there.`,
  );
  on.setValue({ node: x, value: valueOf(to) }).pointer({ name: 'x', node: x });
  on.highlight({ nodes: [x] });
  if (p !== null && !order) {
    step(
      'cut',
      `Cut ${keyText(to)} off ${key(h, p)}: it joins the root list just left of the minimum, unmarked.`,
    );
    h = cut(h, x, on);
    for (let y = p; nodeOf(h, y).parent !== null;) {
      const z = nodeOf(h, y).parent!;
      if (!nodeOf(h, y).mark) {
        step(
          'mark',
          `${key(h, y)} has now lost a child, its first since it became a child: mark it, and stop.`,
        );
        mark(on, y, true);
        on.highlight({ nodes: [y] });
        h = withNode(h, y, { mark: true });
        break;
      }
      step(
        'cascade',
        `${key(h, y)} is marked, so this is its second lost child: cut it too, and go on with its parent ${key(h, z)}.`,
      );
      on.highlight({ nodes: [y] });
      h = cut(h, y, on);
      y = z;
    }
  }
  if (to < nodeOf(h, h.min!).key) {
    step(
      'new-min',
      `${keyText(to)} < ${key(h, h.min!)}: ${keyText(to)} is the new minimum.`,
    );
    on.pointer({ name: 'min', node: x });
    h = { ...h, min: x };
  }
  return { ...s, heap: h };
}

/** FIB-HEAP-DELETE: decrease the key to −∞, then extract it. */
export function deleteKey(s: FibState, k: number, run: FibRun): FibState {
  return extractMin(decreaseKey(s, k, -Infinity, run), run).state;
}
