/**
 * Binary search tree operations (ADR 0018): search, insert and delete, each
 * from a tree given as keys in insertion order. Equal keys go right, as in
 * `bstInsert`; deleting a node with two children copies its successor (as
 * in CLRS) or, on request, its predecessor.
 */
import type { TreeNode } from '@algoviz/spec';

import { checkFinite, checkLength } from '../check.ts';
import {
  checkOp,
  MAX_SIZE,
  runOps,
  type Applied,
  type OpRun,
  type StructureDef,
} from './run.ts';
import { snippet } from './snippet.ts';
import { silentTape, type Tape } from './tape.ts';

export type BstCall =
  | { readonly op: 'search'; readonly key: number }
  | { readonly op: 'insert'; readonly key: number }
  | {
      readonly op: 'delete';
      readonly key: number;
      readonly replaceWith?: 'successor' | 'predecessor';
    };

interface BstNode {
  readonly key: number;
  readonly left: string | null;
  readonly right: string | null;
}

export interface BstState {
  readonly root: string | null;
  readonly nodes: ReadonlyMap<string, BstNode>;
  /** Number for the next node id. */
  readonly next: number;
}

type T = Tape<'tree'>;
type Side = 'left' | 'right';

const EMPTY: BstState = { root: null, nodes: new Map(), next: 0 };

const nodeOf = (s: BstState, id: string) => s.nodes.get(id)!;
const withNode = (s: BstState, id: string, n: BstNode): BstState => ({
  ...s,
  nodes: new Map(s.nodes).set(id, n),
});
const point = (tape: T, id: string | null) =>
  tape.on.pointer({ name: 'curr', node: id });

const SEARCH = snippet(`
  def search(node, key):
      while node is not None:
          if key == node.key:
              return node  # @found
          node = node.left if key < node.key else node.right  # @go
      return None  # @missing
`);

function search(s: BstState, key: number, tape: T): Applied<BstState> {
  for (let at = s.root; at !== null;) {
    const n = nodeOf(s, at);
    if (n.key === key) {
      tape.step('found', `Found ${key}.`);
      point(tape, at).highlight({ nodes: [at] });
      return { state: s, result: true };
    }
    const side: Side = key < n.key ? 'left' : 'right';
    tape.step(
      'go',
      `${key} ${side === 'left' ? '<' : '>'} ${n.key}: go ${side}.`,
    );
    point(tape, at).highlight({ nodes: [at] });
    at = n[side];
  }
  tape.step('missing', `Reached an empty spot: ${key} is not in the tree.`);
  point(tape, null);
  return { state: s, result: false };
}

const INSERT = snippet(`
  def insert(root, key):
      if root is None:
          return Node(key)  # @root
      node = root
      while True:
          if key < node.key:  # @go
              if node.left is None:
                  node.left = Node(key)  # @left
                  return root
              node = node.left
          else:
              if node.right is None:
                  node.right = Node(key)  # @right
                  return root
              node = node.right
`);

function insert(s: BstState, key: number, tape: T): Applied<BstState> {
  if (s.nodes.size >= MAX_SIZE)
    throw new RangeError(`The tree is full: it holds at most ${MAX_SIZE} keys`);
  const id = `n${s.next}`;
  const added = withNode({ ...s, next: s.next + 1 }, id, {
    key,
    left: null,
    right: null,
  });
  if (s.root === null) {
    tape.step('root', `The tree is empty: ${key} becomes the root.`);
    tape.on.addNode({ node: { id, value: key }, parent: null });
    return { state: { ...added, root: id }, result: null };
  }
  for (let at = s.root; ;) {
    const n = nodeOf(s, at);
    const side: Side = key < n.key ? 'left' : 'right';
    tape.step(
      'go',
      `${key} ${side === 'left' ? '<' : '≥'} ${n.key}: go ${side}.`,
    );
    point(tape, at).highlight({ nodes: [at] });
    const next = n[side];
    if (next === null) {
      tape.step(
        side,
        `Empty spot: insert ${key} as the ${side} child of ${n.key}.`,
      );
      tape.on.addNode({ node: { id, value: key }, parent: at, slot: side });
      point(tape, null);
      return { state: withNode(added, at, { ...n, [side]: id }), result: null };
    }
    at = next;
  }
}

const deleteCode = (by: 'successor' | 'predecessor') => {
  const [near, far, name] =
    by === 'successor' ? ['right', 'left', 'succ'] : ['left', 'right', 'pred'];
  return snippet(`
    def delete(node, key):
        if node is None:
            return None  # @missing
        if key < node.key:
            node.left = delete(node.left, key)  # @left
        elif key > node.key:
            node.right = delete(node.right, key)  # @right
        elif node.left is None:
            return node.right  # @no-left
        elif node.right is None:
            return node.left  # @no-right
        else:
            ${name} = node.${near}  # @replacement
            while ${name}.${far} is not None:
                ${name} = ${name}.${far}
            node.key = ${name}.key  # @copy
            node.${near} = delete(node.${near}, ${name}.key)  # @remove
        return node
  `);
};
const DELETE = {
  successor: deleteCode('successor'),
  predecessor: deleteCode('predecessor'),
};

/** Where a subtree hangs: under a parent's side, or as the root. */
type Place = { readonly parent: string; readonly side: Side } | null;

interface Deleted {
  readonly state: BstState;
  /** The subtree's new root. */
  readonly sub: string | null;
  readonly found: boolean;
}

/** Puts `child` (or nothing) where `id` was, and removes `id`. */
function splice(tape: T, id: string, child: string | null, place: Place) {
  point(tape, null);
  if (child !== null) {
    if (place === null) tape.on.detach({ node: child });
    else tape.on.setChild({ parent: place.parent, child, slot: place.side });
  }
  tape.on.removeNode({ node: id });
}

function removeNode(s: BstState, id: string): BstState {
  const nodes = new Map(s.nodes);
  nodes.delete(id);
  return { ...s, nodes };
}

/** The far-most node on `far` sides below `id`. */
function extreme(s: BstState, id: string, far: Side): string {
  const next = nodeOf(s, id)[far];
  return next === null ? id : extreme(s, next, far);
}

function replaceAndDelete(
  s: BstState,
  at: string,
  by: 'successor' | 'predecessor',
  tape: T,
): Deleted {
  const n = nodeOf(s, at);
  const [near, far]: [Side, Side] =
    by === 'successor' ? ['right', 'left'] : ['left', 'right'];
  const r = extreme(s, n[near]!, far);
  const key = nodeOf(s, r).key;
  // Equal keys go right, so a copied predecessor with an equal key in the
  // left subtree would leave that key on its left. Equal keys elsewhere are
  // ancestors, which the copy keeps in order.
  if (by === 'predecessor') {
    const copies = preorder(s, n.left).filter(
      (id) => nodeOf(s, id).key === key,
    );
    if (copies.length > 1)
      throw new RangeError(
        `Replacing ${n.key} by its predecessor needs distinct keys in its left subtree, but ${key} appears ${copies.length} times; use the successor`,
      );
  }
  const where =
    by === 'successor'
      ? 'smallest key in its right'
      : 'largest key in its left';
  tape.step(
    'replacement',
    `${n.key} has two children: its ${by} ${key} is the ${where} subtree.`,
  );
  point(tape, at)
    .pointer({ name: by === 'successor' ? 'succ' : 'pred', node: r })
    .highlight({ nodes: [r] });
  tape.step('copy', `Copy ${key} into the node.`);
  tape.on.setValue({ node: at, value: key });
  tape.step('remove', `Now delete the old ${key} from the ${near} subtree.`);
  tape.on.pointer({ name: by === 'successor' ? 'succ' : 'pred', node: null });
  const copied = withNode(s, at, { ...n, key });
  const d = del(copied, n[near], key, { parent: at, side: near }, by, tape);
  const state = withNode(d.state, at, {
    ...nodeOf(d.state, at),
    [near]: d.sub,
  });
  return { state, sub: at, found: true };
}

function del(
  s: BstState,
  at: string | null,
  key: number,
  place: Place,
  by: 'successor' | 'predecessor',
  tape: T,
): Deleted {
  if (at === null) {
    tape.step('missing', `Reached an empty spot: ${key} is not in the tree.`);
    point(tape, null);
    return { state: s, sub: null, found: false };
  }
  const n = nodeOf(s, at);
  if (key !== n.key) {
    const side: Side = key < n.key ? 'left' : 'right';
    tape.step(
      side,
      `${key} ${side === 'left' ? '<' : '>'} ${n.key}: delete from the ${side} subtree.`,
    );
    point(tape, at).highlight({ nodes: [at] });
    const d = del(s, n[side], key, { parent: at, side }, by, tape);
    const state = withNode(d.state, at, {
      ...nodeOf(d.state, at),
      [side]: d.sub,
    });
    return { state, sub: at, found: d.found };
  }
  if (n.left !== null && n.right !== null)
    return replaceAndDelete(s, at, by, tape);
  const [anchor, child] =
    n.left === null ? ['no-left', n.right] : ['no-right', n.left];
  tape.step(
    anchor,
    child === null
      ? `${key} is a leaf: remove it.`
      : `${key} has one child: its subtree takes the node's place.`,
  );
  point(tape, at).highlight({ nodes: [at] });
  splice(tape, at, child, place);
  return { state: removeNode(s, at), sub: child, found: true };
}

function preorder(s: BstState, id: string | null): string[] {
  if (id === null) return [];
  const n = nodeOf(s, id);
  return [id, ...preorder(s, n.left), ...preorder(s, n.right)];
}

const bstDef: StructureDef<BstState, readonly number[], 'tree', BstCall> = {
  name: 'bst',
  kind: 'tree',
  title: 'Binary search tree',
  start(from) {
    if (!Array.isArray(from)) throw new RangeError('from must be an array');
    checkLength('from', from, MAX_SIZE);
    checkFinite('from', from);
    const tape = silentTape('tree');
    return from.reduce((s, key) => insert(s, key, tape).state, EMPTY);
  },
  describe: (s) => preorder(s, s.root).map((id) => nodeOf(s, id).key),
  declare(s) {
    const nodes = preorder(s, s.root).map((id): TreeNode => {
      const { key, left, right } = nodeOf(s, id);
      return left === null && right === null
        ? { id, value: key }
        : { id, value: key, children: [left, right] };
    });
    return {
      kind: 'tree',
      binary: true,
      nodes,
      roots: s.root === null ? [] : [s.root],
    };
  },
  clear(tape) {
    tape.on.pointer({ name: 'curr', node: null });
  },
  check(call) {
    checkOp(call.op, ['search', 'insert', 'delete']);
    checkFinite('key', [call.key]);
    const by = call.op === 'delete' ? call.replaceWith : undefined;
    if (by !== undefined && by !== 'successor' && by !== 'predecessor')
      throw new RangeError('replaceWith must be "successor" or "predecessor"');
  },
  titleOf: (call) => `${call.op} ${call.key}`,
  code: (call) =>
    call.op === 'search'
      ? SEARCH
      : call.op === 'insert'
        ? INSERT
        : DELETE[call.replaceWith ?? 'successor'],
  apply(s, call, tape) {
    if (call.op === 'search') return search(s, call.key, tape);
    if (call.op === 'insert') return insert(s, call.key, tape);
    const d = del(
      s,
      s.root,
      call.key,
      null,
      call.replaceWith ?? 'successor',
      tape,
    );
    return { state: { ...d.state, root: d.sub }, result: d.found };
  },
};

type Args<Op extends BstCall['op']> = Omit<
  Extract<BstCall, { op: Op }>,
  'op'
> & {
  readonly from: readonly number[];
};

/** Operations on a binary search tree given as keys in insertion order. */
export const bst = {
  run: (args: {
    readonly from: readonly number[];
    readonly ops: readonly BstCall[];
  }): OpRun<readonly number[]> => runOps(bstDef, args.from, args.ops),
  search: ({ from, ...call }: Args<'search'>) =>
    runOps(bstDef, from, [{ op: 'search', ...call }]),
  insert: ({ from, ...call }: Args<'insert'>) =>
    runOps(bstDef, from, [{ op: 'insert', ...call }]),
  delete: ({ from, ...call }: Args<'delete'>) =>
    runOps(bstDef, from, [{ op: 'delete', ...call }]),
};
