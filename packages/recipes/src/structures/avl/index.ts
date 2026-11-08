/**
 * AVL tree insertion (ADR 0023): `avl.insert` descends as in a binary
 * search tree, adds the key as a leaf, and on the way back up updates each
 * height and rebalances with one or two rotations. Keys are distinct, so
 * inserting a key the tree holds changes nothing. A tree starts from keys
 * in insertion order; `after` lists its keys in level order, which rebuild
 * the same tree without a rotation. Each node is annotated with its height.
 */
import type { TreeNode } from '@algoviz/spec';
import { z } from 'zod';

import type { Handle } from '../../recorder.ts';
import { listing } from '../../snippet.ts';
import {
  defineStructure,
  MAX_SIZE,
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

interface AvlNode {
  readonly key: number;
  readonly left: string | null;
  readonly right: string | null;
  /** Height: 1 for a leaf. */
  readonly h: number;
}

export interface AvlState {
  readonly root: string | null;
  readonly nodes: ReadonlyMap<string, AvlNode>;
  /** Number for the next node id. */
  readonly next: number;
}

type On = Handle<'tree'>;
type Side = 'left' | 'right';

const EMPTY: AvlState = { root: null, nodes: new Map(), next: 0 };

const nodeOf = (s: AvlState, id: string) => s.nodes.get(id)!;
const withNode = (s: AvlState, id: string, n: AvlNode): AvlState => ({
  ...s,
  nodes: new Map(s.nodes).set(id, n),
});
const height = (s: AvlState, id: string | null) =>
  id === null ? 0 : nodeOf(s, id).h;
/** The node with its height recomputed from its children. */
const updated = (s: AvlState, id: string): AvlState => {
  const n = nodeOf(s, id);
  const h = 1 + Math.max(height(s, n.left), height(s, n.right));
  return withNode(s, id, { ...n, h });
};
const note = (on: On, id: string, h: number) =>
  on.annotate({ node: id, text: `h=${h}` });

const INSERT = listing('insert', {
  pseudocode: `
    AVL-INSERT(x, key)  // the height of NIL is 0
        if x == NIL
            return NEW-NODE(key)  // a leaf, of height 1  // @new
        if key == x.key
            return x  // @present
        if key < x.key  // @go
            x.left = AVL-INSERT(x.left, key)
        else x.right = AVL-INSERT(x.right, key)
        x.h = 1 + max(x.left.h, x.right.h)  // @height
        return BALANCE(x)

    BALANCE(x)
        if x.left.h > x.right.h + 1
            if x.left.left.h < x.left.right.h
                x.left = LEFT-ROTATE(x.left)  // @left-right
            return RIGHT-ROTATE(x)  // @rotate-right
        if x.right.h > x.left.h + 1
            if x.right.right.h < x.right.left.h
                x.right = RIGHT-ROTATE(x.right)  // @right-left
            return LEFT-ROTATE(x)  // @rotate-left
        return x

    LEFT-ROTATE(x)
        y = x.right
        x.right = y.left
        y.left = x
        x.h = 1 + max(x.left.h, x.right.h)
        y.h = 1 + max(y.left.h, y.right.h)
        return y

    RIGHT-ROTATE(x)
        y = x.left
        x.left = y.right
        y.right = x
        x.h = 1 + max(x.left.h, x.right.h)
        y.h = 1 + max(y.left.h, y.right.h)
        return y
  `,
  python: `
    def height(x):
        return x.h if x else 0

    def insert(x, key):
        if x is None:
            return Node(key)  # a leaf, with h = 1  # @new
        if key == x.key:
            return x  # @present
        if key < x.key:  # @go
            x.left = insert(x.left, key)
        else:
            x.right = insert(x.right, key)
        x.h = 1 + max(height(x.left), height(x.right))  # @height
        return balance(x)

    def balance(x):
        if height(x.left) > height(x.right) + 1:
            if height(x.left.left) < height(x.left.right):
                x.left = rotate_left(x.left)  # @left-right
            return rotate_right(x)  # @rotate-right
        if height(x.right) > height(x.left) + 1:
            if height(x.right.right) < height(x.right.left):
                x.right = rotate_right(x.right)  # @right-left
            return rotate_left(x)  # @rotate-left
        return x

    def rotate_left(x):
        y = x.right
        x.right, y.left = y.left, x
        x.h = 1 + max(height(x.left), height(x.right))
        y.h = 1 + max(height(y.left), height(y.right))
        return y

    def rotate_right(x):
        y = x.left
        x.left, y.right = y.right, x
        x.h = 1 + max(height(x.left), height(x.right))
        y.h = 1 + max(height(y.left), height(y.right))
        return y
  `,
});

const other = (side: Side): Side => (side === 'left' ? 'right' : 'left');

/**
 * Rotates the subtree at `x` so that its child on side `up` takes its
 * place: a left rotation lifts the right child. Returns the new root.
 */
function rotate(
  s: AvlState,
  x: string,
  direction: Side,
  on: On,
): { state: AvlState; id: string } {
  const up = other(direction);
  const n = nodeOf(s, x);
  const y = n[up]!;
  const m = nodeOf(s, y);
  let next = withNode(s, x, { ...n, [up]: m[direction] });
  next = withNode(next, y, { ...m, [direction]: x });
  next = updated(updated(next, x), y);
  on.rotate({ node: x, direction });
  note(on, x, nodeOf(next, x).h);
  note(on, y, nodeOf(next, y).h);
  return { state: next, id: y };
}

interface Inserted {
  readonly state: AvlState;
  /** The root of the subtree after the insertion. */
  readonly id: string;
  /** False when the key was there already. */
  readonly changed: boolean;
}

/** Rebalances the subtree at `x`, whose height is up to date. */
function balance(s: AvlState, x: string, trace: Trace, on: On): Inserted {
  const n = nodeOf(s, x);
  const b = height(s, n.left) - height(s, n.right);
  if (Math.abs(b) <= 1) return { state: s, id: x, changed: true };
  // The heavy side, and the rotation that lifts its child.
  const heavy: Side = b > 1 ? 'left' : 'right';
  const turn = other(heavy);
  let state = s;
  const child = n[heavy]!;
  const c = nodeOf(s, child);
  if (height(s, c[heavy]) < height(s, c[turn])) {
    trace.step(
      heavy === 'left' ? 'left-right' : 'right-left',
      `${n.key} is ${heavy}-heavy and its ${heavy} child ${c.key} leans ${turn}: rotate ${c.key} ${heavy} first.`,
    );
    const r = rotate(state, child, heavy, on);
    state = withNode(r.state, x, { ...nodeOf(r.state, x), [heavy]: r.id });
  }
  trace.step(
    heavy === 'left' ? 'rotate-right' : 'rotate-left',
    `${n.key} is ${heavy}-heavy: rotate it ${turn}, lifting its ${heavy} child.`,
  );
  const r = rotate(state, x, turn, on);
  return { state: r.state, id: r.id, changed: true };
}

function insertAt(
  s: AvlState,
  at: string | null,
  key: number,
  parent: string | null,
  side: Side,
  trace: Trace,
  on: On,
): Inserted {
  if (at === null) {
    const id = `n${s.next}`;
    trace.step(
      'new',
      parent === null
        ? `The tree is empty: ${key} becomes the root, of height 1.`
        : `Insert ${key} here, as the ${side} child of ${nodeOf(s, parent).key}, with height 1.`,
    );
    on.addNode({
      node: { id, value: key },
      parent,
      ...(parent === null ? {} : { slot: side }),
    });
    note(on, id, 1);
    const state = withNode({ ...s, next: s.next + 1 }, id, {
      key,
      left: null,
      right: null,
      h: 1,
    });
    return { state, id, changed: true };
  }
  const n = nodeOf(s, at);
  if (key === n.key) {
    trace.step(
      'present',
      `${key} is already in the tree: nothing changes, so no height does either.`,
    );
    on.pointer({ name: 'x', node: at }).highlight({ nodes: [at] });
    return { state: s, id: at, changed: false };
  }
  const to: Side = key < n.key ? 'left' : 'right';
  trace.step('go', `${key} ${to === 'left' ? '<' : '>'} ${n.key}: go ${to}.`);
  on.pointer({ name: 'x', node: at }).highlight({ nodes: [at] });
  const below = insertAt(s, n[to], key, at, to, trace, on);
  if (!below.changed) return { ...below, id: at };
  let state = withNode(below.state, at, {
    ...nodeOf(below.state, at),
    [to]: below.id,
  });
  state = updated(state, at);
  const { left, right, h } = nodeOf(state, at);
  const [hl, hr] = [height(state, left), height(state, right)];
  trace.step(
    'height',
    `Back at ${n.key}: height ${h}, balance ${hl - hr} (left ${hl}, right ${hr}).`,
    { vars: { h, balance: hl - hr } },
  );
  on.pointer({ name: 'x', node: at }).highlight({ nodes: [at] });
  note(on, at, h);
  return balance(state, at, trace, on);
}

const contains = (s: AvlState, key: number): boolean => {
  for (let at = s.root; at !== null;) {
    const n = nodeOf(s, at);
    if (n.key === key) return true;
    at = key < n.key ? n.left : n.right;
  }
  return false;
};

function insert(
  s: AvlState,
  key: number,
  trace: Trace,
  on: On,
): Applied<AvlState> {
  if (s.nodes.size >= MAX_SIZE && !contains(s, key))
    throw new RangeError(`The tree is full: it holds at most ${MAX_SIZE} keys`);
  // A declaration cannot show heights, so the first step annotates them.
  const marked = afterFirstStep(trace, () => {
    for (const [id, n] of s.nodes) note(on, id, n.h);
  });
  const r = insertAt(s, s.root, key, null, 'left', marked, on);
  on.pointer({ name: 'x', node: null });
  return { state: { ...r.state, root: r.id }, result: null };
}

function preorder(s: AvlState, id: string | null): string[] {
  if (id === null) return [];
  const n = nodeOf(s, id);
  return [id, ...preorder(s, n.left), ...preorder(s, n.right)];
}

/** Keys in level order: every prefix is balanced, so they rebuild the tree. */
function levelOrder(s: AvlState): number[] {
  const out: number[] = [];
  const queue = s.root === null ? [] : [s.root];
  for (let k = 0; k < queue.length; k++) {
    const n = nodeOf(s, queue[k]!);
    out.push(n.key);
    for (const c of [n.left, n.right]) if (c !== null) queue.push(c);
  }
  return out;
}

type From = readonly number[];

const op = operationsOf<AvlState, From, 'tree'>();

/** Insertion into an AVL tree given as keys in insertion order. */
export const avl = defineStructure<AvlState, From, 'tree'>({
  id: 'avl',
  title: 'AVL tree',
  topic: 'trees',
  summary:
    'Inserts keys one after another into an AVL tree, rebalancing it with rotations so that sibling heights differ by at most one.',
  name: 'avl',
  kind: 'tree',
  from: listField(
    z
      .array(z.number())
      .max(MAX_SIZE)
      .describe(
        'Keys in insertion order that build the starting tree, e.g. [10, 20, 30]; a repeated key is skipped.',
      ),
    'number',
  ),
  examples: [
    {
      from: [],
      ops: [10, 20, 30, 40, 50, 25].map((key) => ({ op: 'insert', key })),
    },
  ],
  start(from) {
    const trace = silentTrace();
    const on = silentHandle('tree');
    return from.reduce((s, key) => insert(s, key, trace, on).state, EMPTY);
  },
  describe: levelOrder,
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
  clear(on) {
    on.pointer({ name: 'x', node: null });
  },
  operations: [
    op({
      name: 'insert',
      title: 'insert',
      summary:
        'Inserts a key as a leaf, then on the way back up updates heights and rotates where siblings differ by more than one.',
      args: { key: z.number().describe('The key to insert.') },
      examples: [
        { from: [10, 20, 30, 40, 50], key: 25 },
        { from: [30, 20], key: 10 },
      ],
      code: INSERT,
      titleOf: ({ key }) => `insert ${key}`,
      apply: (s, { key }, trace, on) => insert(s, key, trace, on),
    }),
  ],
});
