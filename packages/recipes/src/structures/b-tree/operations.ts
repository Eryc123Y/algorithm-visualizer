/**
 * B-tree search, insertion and deletion (ADR 0035), recorded step by step
 * on the `btree` drawing. Insertion and deletion are CLRS's one-pass
 * procedures: insertion splits every full node before entering it, and
 * deletion makes sure every node it enters has at least t keys, so neither
 * ever walks back up. Deletion's steps are named after CLRS's cases.
 */
import type { Handle } from '../../recorder.ts';
import { MAX_SIZE } from '../../structure.ts';
import type { Steps } from '../red-black/engine.ts';
import {
  compare,
  isLeaf,
  nodeOf,
  size,
  withNodes,
  without,
  type BKey,
  type BNode,
  type BTree,
  type KeyValue,
} from './model.ts';

export interface BRun {
  readonly step: Steps;
  readonly on: Handle<'btree'>;
}

const show = (n: BNode) => `[${n.keys.map((k) => String(k.value)).join(' ')}]`;
const word = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** The first position whose key is not less than `k`. */
function scan(n: BNode, k: KeyValue): number {
  let i = 0;
  while (i < n.keys.length && compare(k, n.keys[i]!.value) > 0) i++;
  return i;
}

/** Where `k` stands among a node's keys, in words. */
function placeOf(n: BNode, k: KeyValue, i: number): string {
  const v = String(k);
  if (n.keys.length === 0) return `The node is empty`;
  if (i === 0) return `${v} < ${String(n.keys[0]!.value)}`;
  if (i === n.keys.length) return `${v} > ${String(n.keys.at(-1)!.value)}`;
  return `${v} lies between ${String(n.keys[i - 1]!.value)} and ${String(n.keys[i]!.value)}`;
}

/** The node holding `k`, and its position there, if any. */
function locate(b: BTree, k: KeyValue): { node: BNode; i: number } | null {
  for (let n = nodeOf(b, b.root); ;) {
    const i = scan(n, k);
    if (i < n.keys.length && compare(k, n.keys[i]!.value) === 0)
      return { node: n, i };
    if (isLeaf(n)) return null;
    n = nodeOf(b, n.children[i]!);
  }
}

/** B-TREE-SEARCH: down one path, comparing keys left to right. */
export function search(b: BTree, k: KeyValue, run: BRun): boolean {
  const { on, step } = run;
  for (let n = nodeOf(b, b.root); ;) {
    const i = scan(n, k);
    const compared = n.keys.slice(0, Math.min(i + 1, n.keys.length));
    if (i < n.keys.length && compare(k, n.keys[i]!.value) === 0) {
      step('found', `${String(k)} is in ${show(n)}: found.`);
      on.pointer({ name: 'x', node: n.id })
        .highlight({ keys: compared.map((c) => c.id) })
        .settle({ key: n.keys[i]!.id });
      return true;
    }
    if (isLeaf(n)) {
      step(
        'missing',
        n.keys.length === 0
          ? `The tree is empty: ${String(k)} is not in it.`
          : `${placeOf(n, k, i)}, and ${show(n)} is a leaf: ${String(k)} is not in the tree.`,
      );
      on.pointer({ name: 'x', node: n.id });
      if (compared.length > 0)
        on.highlight({ keys: compared.map((c) => c.id) });
      return false;
    }
    step('down', `${placeOf(n, k, i)}: go down to child ${i}.`);
    on.pointer({ name: 'x', node: n.id });
    if (compared.length > 0) on.highlight({ keys: compared.map((c) => c.id) });
    n = nodeOf(b, n.children[i]!);
  }
}

/**
 * B-TREE-SPLIT-CHILD: child `i` of `x`, which is full, gives its middle
 * key to `x` and its upper half to a new node.
 */
function splitChild(
  b: BTree,
  xId: string,
  i: number,
  on: Handle<'btree'>,
): BTree {
  const x = nodeOf(b, xId);
  const y = nodeOf(b, x.children[i]!);
  const m = Math.floor((y.keys.length - 1) / 2);
  const z: BNode = {
    id: `n${b.nextNode}`,
    keys: y.keys.slice(m + 1),
    children: isLeaf(y) ? [] : y.children.slice(m + 1),
  };
  on.split({ node: x.id, index: i, newNode: z.id });
  const next = withNodes(
    { ...b, nextNode: b.nextNode + 1 },
    {
      ...x,
      keys: [...x.keys.slice(0, i), y.keys[m]!, ...x.keys.slice(i)],
      children: [
        ...x.children.slice(0, i + 1),
        z.id,
        ...x.children.slice(i + 1),
      ],
    },
    {
      ...y,
      keys: y.keys.slice(0, m),
      children: isLeaf(y) ? [] : y.children.slice(0, m + 1),
    },
    z,
  );
  return next;
}

/** B-TREE-INSERT, one pass: a key the tree holds changes nothing. */
export function insert(b: BTree, k: KeyValue, run: BRun): BTree {
  const { on, step } = run;
  const present = locate(b, k);
  if (present !== null) {
    step('present', `${String(k)} is already in the tree: nothing changes.`);
    on.pointer({ name: 'x', node: present.node.id }).highlight({
      keys: [present.node.keys[present.i]!.id],
    });
    return b;
  }
  if (size(b) >= MAX_SIZE)
    throw new RangeError(`The tree is full: it holds at most ${MAX_SIZE} keys`);
  let tree = b;
  const full = (n: BNode) => n.keys.length === 2 * tree.t - 1;
  if (full(nodeOf(tree, tree.root))) {
    const old = nodeOf(tree, tree.root);
    const s: BNode = { id: `n${tree.nextNode}`, keys: [], children: [old.id] };
    step(
      'grow',
      `The root ${show(old)} is full: put a new, empty root above it and split the old root, so the tree grows by a level at the top.`,
    );
    on.grow({ newRoot: s.id });
    tree = withNodes({ ...tree, nextNode: tree.nextNode + 1, root: s.id }, s);
    tree = splitChild(tree, s.id, 0, on);
    on.pointer({ name: 'x', node: s.id });
  }
  for (let x = tree.root; ;) {
    let n = nodeOf(tree, x);
    let i = scan(n, k);
    if (isLeaf(n)) {
      const key: BKey = { id: `k${tree.nextKey}`, value: k };
      step(
        'leaf',
        `${placeOf(n, k, i)}, and ${show(n)} is a leaf: insert ${String(k)} at position ${i}.`,
      );
      on.pointer({ name: 'x', node: n.id }).insertKey({
        node: n.id,
        index: i,
        key,
      });
      return withNodes(
        { ...tree, nextKey: tree.nextKey + 1 },
        { ...n, keys: [...n.keys.slice(0, i), key, ...n.keys.slice(i)] },
      );
    }
    const child = nodeOf(tree, n.children[i]!);
    if (full(child)) {
      const m = child.keys[Math.floor((child.keys.length - 1) / 2)]!;
      step(
        'split',
        `${placeOf(n, k, i)}, and child ${i}, ${show(child)}, is full: split it before going down, lifting its middle key ${String(m.value)} into ${show(n)}.`,
      );
      on.pointer({ name: 'x', node: n.id });
      tree = splitChild(tree, n.id, i, on);
      n = nodeOf(tree, x);
      if (compare(k, m.value) > 0) i++;
    }
    step('down', `${placeOf(n, k, i)}: go down to child ${i}.`);
    on.pointer({ name: 'x', node: n.id });
    x = n.children[i]!;
  }
}

/** The key at one end of a subtree: its least (`first`) or greatest. */
function extreme(b: BTree, id: string, first: boolean): BKey {
  let n = nodeOf(b, id);
  while (!isLeaf(n)) n = nodeOf(b, first ? n.children[0]! : n.children.at(-1)!);
  return first ? n.keys[0]! : n.keys.at(-1)!;
}

/** MERGE child `i` of `x` with key `i` and child `i + 1`. */
function merge(b: BTree, xId: string, i: number, on: Handle<'btree'>): BTree {
  const x = nodeOf(b, xId);
  const [l, r] = [nodeOf(b, x.children[i]!), nodeOf(b, x.children[i + 1]!)];
  on.merge({ node: x.id, index: i });
  return without(
    withNodes(
      b,
      {
        ...x,
        keys: x.keys.filter((_, k) => k !== i),
        children: x.children.filter((_, k) => k !== i + 1),
      },
      {
        ...l,
        keys: [...l.keys, x.keys[i]!, ...r.keys],
        children: [...l.children, ...r.children],
      },
    ),
    r.id,
  );
}

/** A key moves from a sibling of child `i` of `x`, through `x`. */
function borrow(
  b: BTree,
  xId: string,
  i: number,
  from: 'left' | 'right',
  on: Handle<'btree'>,
): BTree {
  const x = nodeOf(b, xId);
  const c = nodeOf(b, x.children[i]!);
  const sib = nodeOf(b, x.children[from === 'right' ? i + 1 : i - 1]!);
  const sep = from === 'right' ? i : i - 1;
  on.borrow({ node: x.id, child: i, from });
  const inner = !isLeaf(c);
  if (from === 'right')
    return withNodes(
      b,
      { ...x, keys: x.keys.map((k, j) => (j === sep ? sib.keys[0]! : k)) },
      {
        ...c,
        keys: [...c.keys, x.keys[sep]!],
        children: inner ? [...c.children, sib.children[0]!] : [],
      },
      {
        ...sib,
        keys: sib.keys.slice(1),
        children: inner ? sib.children.slice(1) : [],
      },
    );
  return withNodes(
    b,
    { ...x, keys: x.keys.map((k, j) => (j === sep ? sib.keys.at(-1)! : k)) },
    {
      ...c,
      keys: [x.keys[sep]!, ...c.keys],
      children: inner ? [sib.children.at(-1)!, ...c.children] : [],
    },
    {
      ...sib,
      keys: sib.keys.slice(0, -1),
      children: inner ? sib.children.slice(0, -1) : [],
    },
  );
}

/** A root left with no keys gives way to its one child. */
function shrinkRoot(b: BTree, run: BRun): BTree {
  const root = nodeOf(b, b.root);
  if (root.keys.length > 0 || isLeaf(root)) return b;
  const child = root.children[0]!;
  run.step(
    'shrink',
    `The root has no keys left: its one child ${show(nodeOf(b, child))} becomes the root, and the tree loses a level at the top.`,
  );
  run.on.shrink().pointer({ name: 'x', node: child });
  return { ...without(b, root.id), root: child };
}

/**
 * B-TREE-DELETE, one pass: every node the walk enters below the root has
 * at least t keys first, so a key can always leave a leaf.
 */
export function remove(b: BTree, k: KeyValue, run: BRun): BTree {
  return deleteFrom(b, b.root, k, run, null, 'lift-pred');
}

/**
 * Deletes `k` from the subtree at `xId`. With `over`, `k` is the
 * predecessor or successor of the key `over`, and rises into its place
 * instead of leaving (cases 2a and 2b).
 */
function deleteFrom(
  b: BTree,
  xId: string,
  k: KeyValue,
  run: BRun,
  over: BKey | null,
  /** The step that lifts the key: from the left subtree or the right. */
  liftStep: 'lift-pred' | 'lift-succ',
): BTree {
  const { on, step } = run;
  const t = b.t;
  let tree = b;
  let x = xId;
  for (;;) {
    const n = nodeOf(tree, x);
    const i = scan(n, k);
    const here = i < n.keys.length && compare(k, n.keys[i]!.value) === 0;
    if (here && isLeaf(n)) {
      if (over !== null) {
        step(
          liftStep,
          `${String(k)} leaves the leaf and rises into the place of ${String(over.value)}, which is gone.`,
        );
        on.pointer({ name: 'x', node: n.id }).lift({
          key: n.keys[i]!.id,
          over: over.id,
        });
        return liftKey(tree, n, i, over);
      }
      step('case-1', `${String(k)} is in the leaf ${show(n)}: take it out.`);
      on.pointer({ name: 'x', node: n.id }).removeKey({ key: n.keys[i]!.id });
      return withNodes(tree, { ...n, keys: n.keys.filter((_, j) => j !== i) });
    }
    if (here) {
      const key = n.keys[i]!;
      const [y, z] = [
        nodeOf(tree, n.children[i]!),
        nodeOf(tree, n.children[i + 1]!),
      ];
      if (y.keys.length >= t) {
        const pred = extreme(tree, y.id, false);
        step(
          'case-2a',
          `${String(k)} is in ${show(n)}, and its left child has ${word(y.keys.length, 'key', 'keys')}, at least t = ${t}: its predecessor ${String(pred.value)} will take its place. First delete ${String(pred.value)} from that subtree.`,
        );
        on.pointer({ name: 'x', node: n.id }).highlight({
          keys: [key.id, pred.id],
        });
        return deleteFrom(tree, y.id, pred.value, run, key, 'lift-pred');
      }
      if (z.keys.length >= t) {
        const succ = extreme(tree, z.id, true);
        step(
          'case-2b',
          `${String(k)} is in ${show(n)}; its left child has only t − 1 = ${t - 1} keys but its right child has ${z.keys.length}: its successor ${String(succ.value)} will take its place. First delete ${String(succ.value)} from that subtree.`,
        );
        on.pointer({ name: 'x', node: n.id }).highlight({
          keys: [key.id, succ.id],
        });
        return deleteFrom(tree, z.id, succ.value, run, key, 'lift-succ');
      }
      step(
        'case-2c',
        `${String(k)} is in ${show(n)}, and both its children have t − 1 = ${t - 1} keys: merge them, with ${String(k)} between them, and delete ${String(k)} from the merged node.`,
      );
      on.pointer({ name: 'x', node: n.id });
      tree = merge(tree, n.id, i, on);
      tree = shrinkRoot(tree, run);
      x = y.id;
      continue;
    }
    if (isLeaf(n)) {
      step(
        'missing',
        `${placeOf(n, k, i)}, and ${show(n)} is a leaf: ${String(k)} is not in the tree, so nothing changes.`,
      );
      on.pointer({ name: 'x', node: n.id });
      return tree;
    }
    const c = nodeOf(tree, n.children[i]!);
    if (c.keys.length === t - 1) {
      // The node to go down into: the child, or what it merges into.
      let target = c.id;
      const left = i > 0 ? nodeOf(tree, n.children[i - 1]!) : undefined;
      const right =
        i < n.children.length - 1
          ? nodeOf(tree, n.children[i + 1]!)
          : undefined;
      if (left !== undefined && left.keys.length >= t) {
        step(
          'case-3a',
          `${placeOf(n, k, i)}, so ${String(k)} would be under child ${i}, ${show(c)}, which has only t − 1 = ${t - 1} keys. Its left sibling ${show(left)} has a key to spare: it moves up, and ${String(n.keys[i - 1]!.value)} moves down.`,
        );
        on.pointer({ name: 'x', node: n.id });
        tree = borrow(tree, n.id, i, 'left', on);
      } else if (right !== undefined && right.keys.length >= t) {
        step(
          'case-3a',
          `${placeOf(n, k, i)}, so ${String(k)} would be under child ${i}, ${show(c)}, which has only t − 1 = ${t - 1} keys. Its right sibling ${show(right)} has a key to spare: it moves up, and ${String(n.keys[i]!.value)} moves down.`,
        );
        on.pointer({ name: 'x', node: n.id });
        tree = borrow(tree, n.id, i, 'right', on);
      } else {
        const at = right !== undefined ? i : i - 1;
        target = n.children[at]!;
        step(
          'case-3b',
          `${placeOf(n, k, i)}, so ${String(k)} would be under child ${i}, ${show(c)}, which has only t − 1 = ${t - 1} keys, and so ${left !== undefined && right !== undefined ? 'do both its siblings' : 'does its one sibling'}: merge it with its ${right !== undefined ? 'right' : 'left'} sibling and ${String(n.keys[at]!.value)} between them.`,
        );
        on.pointer({ name: 'x', node: n.id });
        tree = merge(tree, n.id, at, on);
        tree = shrinkRoot(tree, run);
      }
      x = target;
      continue;
    }
    step(
      'down',
      `${placeOf(n, k, i)}: go down to child ${i}, ${show(c)}, which has more than t − 1 keys.`,
    );
    on.pointer({ name: 'x', node: n.id });
    x = c.id;
  }
}

/** Moves the key at `i` of the leaf `n` into the place of `over`. */
function liftKey(b: BTree, n: BNode, i: number, over: BKey): BTree {
  const key = n.keys[i]!;
  const holder = [...b.nodes.values()].find((m) =>
    m.keys.some((k) => k.id === over.id),
  )!;
  return withNodes(
    b,
    { ...n, keys: n.keys.filter((_, j) => j !== i) },
    { ...holder, keys: holder.keys.map((k) => (k.id === over.id ? key : k)) },
  );
}
