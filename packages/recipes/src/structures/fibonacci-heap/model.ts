/**
 * The model of a Fibonacci heap (ADR 0034): a forest of min-heap-ordered
 * trees whose roots form a circular list, kept in the order drawn from
 * left to right, with `min` naming the root of least key. A node has its
 * children in order (also a circular list in CLRS), its parent, and its
 * mark. States are immutable.
 *
 * Keys are distinct finite numbers; `-Infinity` appears only inside a
 * deletion, which decreases a key to −∞ and extracts it at once.
 */
import type { Scalar } from '@algomotion/spec';

export interface FibNode {
  readonly key: number;
  readonly children: readonly string[];
  readonly parent: string | null;
  readonly mark: boolean;
}

export interface FibHeap {
  /** The roots, left to right. */
  readonly roots: readonly string[];
  readonly nodes: ReadonlyMap<string, FibNode>;
  readonly min: string | null;
  /** Number for the next node id. */
  readonly next: number;
}

export const EMPTY: FibHeap = {
  roots: [],
  nodes: new Map(),
  min: null,
  next: 0,
};

export const nodeOf = (h: FibHeap, id: string): FibNode => {
  const n = h.nodes.get(id);
  if (n === undefined) throw new Error(`No node ${id}`);
  return n;
};

export const withNode = (
  h: FibHeap,
  id: string,
  patch: Partial<FibNode>,
): FibHeap => ({
  ...h,
  nodes: new Map(h.nodes).set(id, { ...nodeOf(h, id), ...patch }),
});

/** A key as a node shows it: −∞ as the string "-∞". */
export const valueOf = (key: number): Scalar =>
  key === -Infinity ? '-∞' : key;

/** A key as narration writes it. */
export const keyText = (key: number): string =>
  key === -Infinity ? '−∞' : String(key);

export const degree = (h: FibHeap, id: string): number =>
  nodeOf(h, id).children.length;

/** The node holding `key`, if any. */
export function findKey(h: FibHeap, key: number): string | undefined {
  for (const [id, n] of h.nodes) if (n.key === key) return id;
  return undefined;
}

/** The root of least key, or null. */
export function minimumRoot(h: FibHeap): string | null {
  let best: string | null = null;
  for (const r of h.roots)
    if (best === null || nodeOf(h, r).key < nodeOf(h, best).key) best = r;
  return best;
}

/** The ids of a node and every node below it, preorder. */
export function subtree(h: FibHeap, id: string): string[] {
  return [id, ...nodeOf(h, id).children.flatMap((c) => subtree(h, c))];
}

/** D(n): the largest degree a heap of `n` nodes can have, ⌊log_φ n⌋. */
export function maxDegree(n: number): number {
  if (n <= 1) return 0;
  const phi = (1 + Math.sqrt(5)) / 2;
  return Math.floor(Math.log(n) / Math.log(phi) + 1e-9);
}

/** One tree of a forest, as the notation and the JSON form describe it. */
export interface Entry {
  readonly key: number;
  readonly marked?: boolean;
  readonly children?: readonly (Entry | number)[];
}

/**
 * Builds a heap from trees left to right, with ids `prefix0`, `prefix1`, …
 * in preorder. Throws a RangeError naming the node if a child's key is
 * less than its parent's, or a key repeats.
 */
export function buildHeap(
  trees: readonly (Entry | number)[],
  prefix = 'n',
): FibHeap {
  const nodes = new Map<string, FibNode>();
  const seen = new Set<number>();
  let next = 0;
  const add = (entry: Entry | number, parent: string | null): string => {
    const e = typeof entry === 'number' ? { key: entry } : entry;
    if (seen.has(e.key))
      throw new RangeError(
        `${keyText(e.key)} is in the heap twice; keys are distinct`,
      );
    seen.add(e.key);
    if (parent !== null && e.key < nodeOf({ ...EMPTY, nodes }, parent).key)
      throw new RangeError(
        `${keyText(e.key)} is below ${keyText(nodes.get(parent)!.key)}, which is larger: a heap keeps every key at least its parent's`,
      );
    const id = `${prefix}${next++}`;
    nodes.set(id, {
      key: e.key,
      children: [],
      parent,
      mark: e.marked ?? false,
    });
    const children = (e.children ?? []).map((c) => add(c, id));
    nodes.set(id, { ...nodes.get(id)!, children });
    return id;
  };
  const roots = trees.map((t) => add(t, null));
  const h: FibHeap = { roots, nodes, min: null, next };
  return { ...h, min: minimumRoot(h) };
}

/** The heap in the forest notation: `23 7 3(18*(39*) 52 38(41))`. */
export function printHeap(h: FibHeap): string {
  const print = (id: string): string => {
    const n = nodeOf(h, id);
    const inner = n.children.map(print).join(' ');
    return `${keyText(n.key)}${n.mark ? '*' : ''}${inner === '' ? '' : `(${inner})`}`;
  };
  return h.roots.map(print).join(' ');
}

/** The heap as JSON entries, for `after`. */
export function entriesOf(h: FibHeap): Entry[] {
  const entry = (id: string): Entry => {
    const n = nodeOf(h, id);
    return {
      key: n.key,
      ...(n.mark ? { marked: true } : {}),
      ...(n.children.length === 0 ? {} : { children: n.children.map(entry) }),
    };
  };
  return h.roots.map(entry);
}
