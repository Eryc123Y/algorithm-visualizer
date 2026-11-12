/**
 * The model of a B-tree of minimum degree `t` (ADR 0035): nodes with keys
 * in order and children, one more than their keys unless a leaf. Keys and
 * nodes have ids, as the drawing does, so the operations can name what
 * they move. States are immutable.
 *
 * Keys are numbers, or words compared as strings, never both in one tree.
 */
export type KeyValue = number | string;

export interface BKey {
  readonly id: string;
  readonly value: KeyValue;
}

export interface BNode {
  readonly id: string;
  readonly keys: readonly BKey[];
  readonly children: readonly string[];
}

export interface BTree {
  readonly t: number;
  readonly root: string;
  readonly nodes: ReadonlyMap<string, BNode>;
  /** Numbers for the next node and key ids. */
  readonly nextNode: number;
  readonly nextKey: number;
}

export const compare = (a: KeyValue, b: KeyValue): number =>
  typeof a === 'number' && typeof b === 'number'
    ? a - b
    : String(a) < String(b)
      ? -1
      : String(a) > String(b)
        ? 1
        : 0;

export const emptyTree = (t: number): BTree => ({
  t,
  root: 'n0',
  nodes: new Map([['n0', { id: 'n0', keys: [], children: [] }]]),
  nextNode: 1,
  nextKey: 0,
});

export const nodeOf = (b: BTree, id: string): BNode => {
  const n = b.nodes.get(id);
  if (n === undefined) throw new Error(`No node ${id}`);
  return n;
};

export const isLeaf = (n: BNode) => n.children.length === 0;

export const withNodes = (b: BTree, ...nodes: BNode[]): BTree => {
  const map = new Map(b.nodes);
  for (const n of nodes) map.set(n.id, n);
  return { ...b, nodes: map };
};

export const without = (b: BTree, id: string): BTree => {
  const map = new Map(b.nodes);
  map.delete(id);
  return { ...b, nodes: map };
};

/** Every key in order. */
export function keysInOrder(b: BTree, id = b.root): KeyValue[] {
  const n = nodeOf(b, id);
  if (isLeaf(n)) return n.keys.map((k) => k.value);
  return n.children.flatMap((c, i) => [
    ...keysInOrder(b, c),
    ...(i < n.keys.length ? [n.keys[i]!.value] : []),
  ]);
}

export const size = (b: BTree): number => keysInOrder(b).length;

/** The tree in the notation `[G M] ([A C] [H K] [N R])`. */
export function printTree(b: BTree, id = b.root): string {
  const n = nodeOf(b, id);
  const keys = `[${n.keys.map((k) => String(k.value)).join(' ')}]`;
  return isLeaf(n)
    ? keys
    : `${keys} (${n.children.map((c) => printTree(b, c)).join(' ')})`;
}

/** A tree as nested key lists, as the notation and JSON give it. */
export interface NodeShape {
  readonly keys: readonly KeyValue[];
  readonly children?: readonly NodeShape[];
}

/**
 * Builds a tree from its shape, with fresh ids, and checks that it is a
 * B-tree of minimum degree `t`: key counts within bounds, every leaf at
 * one depth, keys in order. Throws a RangeError naming the node.
 */
export function buildTree(shape: NodeShape, t: number): BTree {
  let nextNode = 0;
  let nextKey = 0;
  const nodes = new Map<string, BNode>();
  const show = (s: NodeShape) => `[${s.keys.join(' ')}]`;
  let leafDepth: number | undefined;
  const add = (s: NodeShape, depth: number, root: boolean): string => {
    const id = `n${nextNode++}`;
    const n = s.keys.length;
    if (n > 2 * t - 1)
      throw new RangeError(
        `${show(s)} has ${n} keys; a node holds at most 2t − 1 = ${2 * t - 1}`,
      );
    if (!root && n < t - 1)
      throw new RangeError(
        `${show(s)} has ${n} key${n === 1 ? '' : 's'}; a node other than the root holds at least t − 1 = ${t - 1}`,
      );
    const kids = s.children ?? [];
    if (root && n === 0 && kids.length > 0)
      throw new RangeError(
        `The root ${show(s)} has children but no keys; only an empty tree has a root without keys`,
      );
    if (kids.length > 0 && kids.length !== n + 1)
      throw new RangeError(
        `${show(s)} has ${n} keys and ${kids.length} children; it needs ${n + 1}`,
      );
    if (kids.length === 0) {
      if (leafDepth !== undefined && leafDepth !== depth)
        throw new RangeError(
          `The leaf ${show(s)} is at depth ${depth}, another at ${leafDepth}: every leaf is at one depth`,
        );
      leafDepth = depth;
    }
    const keys = s.keys.map((value) => ({ id: `k${nextKey++}`, value }));
    const children = kids.map((c) => add(c, depth + 1, false));
    nodes.set(id, { id, keys, children });
    return id;
  };
  const root = add(shape, 0, true);
  const b: BTree = { t, root, nodes, nextNode, nextKey };
  const order = keysInOrder(b);
  for (let k = 1; k < order.length; k++) {
    const c = compare(order[k - 1]!, order[k]!);
    if (c === 0) throw new RangeError(`${order[k]} is in the tree twice`);
    if (c > 0)
      throw new RangeError(
        `${order[k - 1]} comes before ${order[k]} in order, so this is not a search tree`,
      );
  }
  return b;
}
