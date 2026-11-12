/**
 * The model the red–black family shares (ADR 0034): a red–black tree whose
 * nodes may carry one augmented field, as CLRS builds the order-statistic
 * tree (subtree sizes) and the interval tree (max endpoints) on the
 * red–black tree. States are immutable; every function returns a new one.
 *
 * Keys are generic: numbers for the red–black and order-statistic trees,
 * intervals for the interval tree. They are distinct under `compare`.
 */
import type { Scalar } from '@algomotion/spec';

export type Color = 'red' | 'black';
export type Side = 'left' | 'right';

export const other = (side: Side): Side => (side === 'left' ? 'right' : 'left');

export interface RbNode<K> {
  readonly key: K;
  readonly color: Color;
  readonly left: string | null;
  readonly right: string | null;
  readonly parent: string | null;
  /** The augmented field; 0 in a plain red–black tree. */
  readonly aug: number;
}

export interface RbTree<K> {
  readonly root: string | null;
  readonly nodes: ReadonlyMap<string, RbNode<K>>;
  /** Number for the next node id. */
  readonly next: number;
}

/** How keys compare and show. */
export interface Keys<K> {
  compare(a: K, b: K): number;
  /** The key as narration writes it, e.g. "5" or "[16, 21]". */
  text(key: K): string;
  /** The key as the node's value in the document. */
  value(key: K): Scalar;
}

/** An augmented field, kept current by every change of shape. */
export interface Augment<K> {
  /** The note's field, e.g. "size". */
  readonly field: string;
  /** A node's field from its key and its children's fields; null is NIL. */
  of(key: K, left: number | null, right: number | null): number;
  /** The field of a node on the path down to a new key, as CLRS updates it. */
  down(field: number, key: K): number;
  /** The note that shows the field, e.g. "s=5". */
  note(field: number): string;
}

export const numberKeys: Keys<number> = {
  compare: (a, b) => a - b,
  text: String,
  value: (k) => k,
};

export const EMPTY: RbTree<never> = { root: null, nodes: new Map(), next: 0 };

export const nodeOf = <K>(t: RbTree<K>, id: string): RbNode<K> => {
  const n = t.nodes.get(id);
  if (n === undefined) throw new Error(`No node ${id}`);
  return n;
};

export const withNode = <K>(
  t: RbTree<K>,
  id: string,
  patch: Partial<RbNode<K>>,
): RbTree<K> => ({
  ...t,
  nodes: new Map(t.nodes).set(id, { ...nodeOf(t, id), ...patch }),
});

/** The color of a node, NIL being black. */
export const colorOf = <K>(t: RbTree<K>, id: string | null): Color =>
  id === null ? 'black' : nodeOf(t, id).color;

/** Which side of its parent a node hangs on; undefined for the root. */
export function sideOf<K>(t: RbTree<K>, id: string): Side | undefined {
  const { parent } = nodeOf(t, id);
  if (parent === null) return undefined;
  return nodeOf(t, parent).left === id ? 'left' : 'right';
}

/** The field of a node, or null for NIL. */
export const fieldOf = <K>(t: RbTree<K>, id: string | null): number | null =>
  id === null ? null : nodeOf(t, id).aug;

/** The node with its field recomputed from its children. */
export function recompute<K>(
  t: RbTree<K>,
  id: string,
  aug: Augment<K> | undefined,
): RbTree<K> {
  if (aug === undefined) return t;
  const n = nodeOf(t, id);
  return withNode(t, id, {
    aug: aug.of(n.key, fieldOf(t, n.left), fieldOf(t, n.right)),
  });
}

/** Puts `child` (or NIL) on `side` of `parent`, or at the root. */
export function attach<K>(
  t: RbTree<K>,
  parent: string | null,
  side: Side,
  child: string | null,
): RbTree<K> {
  let next =
    parent === null
      ? { ...t, root: child }
      : withNode(t, parent, { [side]: child });
  if (child !== null) next = withNode(next, child, { parent });
  return next;
}

/**
 * Rotates around `x`: a left rotation lifts its right child `y`, which
 * takes `x`'s place, `x` becoming `y`'s left child and `y`'s left subtree
 * `x`'s right one. Fields are recomputed for `x`, then `y`.
 */
export function rotate<K>(
  t: RbTree<K>,
  x: string,
  direction: Side,
  aug: Augment<K> | undefined,
): RbTree<K> {
  const up = other(direction);
  const nx = nodeOf(t, x);
  const y = nx[up];
  if (y === null) throw new Error(`Node ${x} has no ${up} child to rotate`);
  const inner = nodeOf(t, y)[direction];
  const parent = nx.parent;
  const side = sideOf(t, x) ?? 'left';
  let next = attach(t, x, up, inner);
  next = attach(next, parent, side, y);
  next = attach(next, y, direction, x);
  return recompute(recompute(next, x, aug), y, aug);
}

/**
 * Puts `v` (or NIL) where `u` hangs, leaving `u` detached, as
 * RB-TRANSPLANT does.
 */
export function transplant<K>(
  t: RbTree<K>,
  u: string,
  v: string | null,
): RbTree<K> {
  const { parent } = nodeOf(t, u);
  const next = attach(t, parent, sideOf(t, u) ?? 'left', v);
  return withNode(next, u, { parent: null });
}

/** The node with the least key in the subtree at `id`. */
export function minimum<K>(t: RbTree<K>, id: string): string {
  let at = id;
  for (let left = nodeOf(t, at).left; left !== null;) {
    at = left;
    left = nodeOf(t, at).left;
  }
  return at;
}

/** The node holding `key`, or null. */
export function find<K>(t: RbTree<K>, key: K, keys: Keys<K>): string | null {
  for (let at = t.root; at !== null;) {
    const n = nodeOf(t, at);
    const c = keys.compare(key, n.key);
    if (c === 0) return at;
    at = c < 0 ? n.left : n.right;
  }
  return null;
}

/** The ids in in-order. */
export function inorder<K>(t: RbTree<K>, id = t.root): string[] {
  if (id === null) return [];
  const n = nodeOf(t, id);
  return [...inorder(t, n.left), id, ...inorder(t, n.right)];
}

/** The ids in preorder, the order a declaration lists nodes in. */
export function preorder<K>(t: RbTree<K>, id = t.root): string[] {
  if (id === null) return [];
  const n = nodeOf(t, id);
  return [id, ...preorder(t, n.left), ...preorder(t, n.right)];
}

/** A tree as keys in level order, null for a gap, and its red keys. */
export interface Described<K> {
  readonly levelOrder: readonly (K | null)[];
  readonly red: readonly K[];
}

export function describeTree<K>(t: RbTree<K>): Described<K> {
  const levelOrder: (K | null)[] = [];
  const red: K[] = [];
  const queue: (string | null)[] = [t.root];
  for (let k = 0; k < queue.length; k++) {
    const id = queue[k]!;
    if (id === null) {
      levelOrder.push(null);
      continue;
    }
    const n = nodeOf(t, id);
    levelOrder.push(n.key);
    if (n.color === 'red') red.push(n.key);
    queue.push(n.left, n.right);
  }
  while (levelOrder.length > 0 && levelOrder.at(-1) === null) levelOrder.pop();
  return { levelOrder, red };
}

/**
 * Builds the tree a level order describes, LeetCode style, with the keys
 * in `red` red. Throws a RangeError naming the node if the keys repeat or
 * are out of order, a red key is not in the tree, or a red–black property
 * fails.
 */
export function buildTree<K>(
  { levelOrder, red }: Described<K>,
  keys: Keys<K>,
  aug: Augment<K> | undefined,
): RbTree<K> {
  const isRed = (key: K) => red.some((r) => keys.compare(r, key) === 0);
  const nodes = new Map<string, RbNode<K>>();
  // Nodes in the order placed; each takes the next two entries as children.
  const placed: string[] = [];
  const fresh = (key: K, parent: string | null): string => {
    const id = `n${placed.length}`;
    nodes.set(id, {
      key,
      color: isRed(key) ? 'red' : 'black',
      left: null,
      right: null,
      parent,
      aug: 0,
    });
    placed.push(id);
    return id;
  };
  const first = levelOrder[0] ?? null;
  const root = first === null ? null : fresh(first, null);
  let at = 1;
  for (let k = 0; k < placed.length && at < levelOrder.length; k++) {
    const parent = placed[k]!;
    for (const side of ['left', 'right'] as const) {
      const key = at < levelOrder.length ? (levelOrder[at++] ?? null) : null;
      if (key === null) continue;
      const id = fresh(key, parent);
      nodes.set(parent, { ...nodes.get(parent)!, [side]: id });
    }
  }
  const orphan = levelOrder.slice(at).find((v) => v !== null);
  if (orphan !== undefined && orphan !== null)
    throw new RangeError(
      `${keys.text(orphan)} has no parent in the level order: every slot before it is taken or empty`,
    );
  for (const r of red)
    if (!placed.some((id) => keys.compare(nodes.get(id)!.key, r) === 0))
      throw new RangeError(
        `${keys.text(r)} is listed as red but is not in the tree`,
      );
  let t: RbTree<K> = { root, nodes, next: placed.length };
  checkTree(t, keys);
  // Fields bottom up: children come after their parents in level order.
  for (const id of [...placed].reverse()) t = recompute(t, id, aug);
  return t;
}

/**
 * Throws a RangeError naming the first node that breaks search order,
 * repeats a key, or breaks a red–black property: a red root, a red node
 * with a red child, or paths with different numbers of black nodes.
 */
export function checkTree<K>(t: RbTree<K>, keys: Keys<K>): void {
  const order = inorder(t);
  for (let k = 1; k < order.length; k++) {
    const [a, b] = [nodeOf(t, order[k - 1]!).key, nodeOf(t, order[k]!).key];
    const c = keys.compare(a, b);
    if (c === 0) throw new RangeError(`${keys.text(b)} is in the tree twice`);
    if (c > 0)
      throw new RangeError(
        `${keys.text(a)} comes before ${keys.text(b)} in order, so this is not a search tree`,
      );
  }
  if (t.root !== null && colorOf(t, t.root) === 'red')
    throw new RangeError(
      `The root ${keys.text(nodeOf(t, t.root).key)} is red; a root is black`,
    );
  const blackHeight = (id: string | null): number => {
    if (id === null) return 1;
    const n = nodeOf(t, id);
    for (const c of [n.left, n.right])
      if (n.color === 'red' && colorOf(t, c) === 'red')
        throw new RangeError(
          `${keys.text(n.key)} is red and so is its child ${keys.text(nodeOf(t, c!).key)}`,
        );
    const [l, r] = [blackHeight(n.left), blackHeight(n.right)];
    if (l !== r)
      throw new RangeError(
        `Paths below ${keys.text(n.key)} have different numbers of black nodes (${l} on the left, ${r} on the right)`,
      );
    return l + (n.color === 'black' ? 1 : 0);
  };
  blackHeight(t.root);
}
