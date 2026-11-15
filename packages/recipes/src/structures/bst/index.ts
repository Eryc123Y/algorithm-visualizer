/**
 * Binary search tree operations (ADR 0018, 0019): `bst.search`,
 * `bst.insert` and `bst.delete`, each from a tree given as keys in
 * insertion order, and the sequence `bst`, whose examples include a whole
 * life from an empty tree. Equal keys go right; deleting a node with two
 * children copies its successor (as in CLRS) or, on request, its
 * predecessor. The code is in pseudocode and Python (ADR 0017).
 */
import type { TreeNode } from '@algomotion/spec';
import { z } from 'zod';

import type { Handle } from '../../recorder.ts';
import { listing } from '../../snippet.ts';
import {
  defineStructure,
  MAX_SIZE,
  operationsOf,
  type Applied,
} from '../../structure.ts';
import { silentHandle, silentTrace, type Trace } from '../../trace.ts';
import { listField } from '../../notation/schema.ts';

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

type On = Handle<'tree'>;
type Side = 'left' | 'right';
/** The sides in Chinese (ADR 0045). */
const SIDE_ZH = { left: '左', right: '右' } as const;

const EMPTY: BstState = { root: null, nodes: new Map(), next: 0 };

const nodeOf = (s: BstState, id: string) => s.nodes.get(id)!;
const withNode = (s: BstState, id: string, n: BstNode): BstState => ({
  ...s,
  nodes: new Map(s.nodes).set(id, n),
});
const point = (on: On, id: string | null) =>
  on.pointer({ name: 'curr', node: id });

const SEARCH = listing('search', {
  pseudocode: `
    TREE-SEARCH(node, key)
        while node ≠ NIL
            if key == node.key
                return node  // @found
            elseif key < node.key  // @go
                node = node.left
            else node = node.right
        return NIL  // @missing
  `,
  python: `
    def search(node, key):
        while node is not None:
            if key == node.key:
                return node  # @found
            node = node.left if key < node.key else node.right  # @go
        return None  # @missing
  `,
});

function search(
  s: BstState,
  key: number,
  trace: Trace,
  on: On,
): Applied<BstState> {
  for (let at = s.root; at !== null;) {
    const n = nodeOf(s, at);
    if (n.key === key) {
      trace.step('found', { en: `Found ${key}.`, zh: `找到 ${key}。` });
      point(on, at).highlight({ nodes: [at] });
      return { state: s, result: true };
    }
    const side: Side = key < n.key ? 'left' : 'right';
    trace.step('go', {
      en: `${key} ${side === 'left' ? '<' : '>'} ${n.key}: go ${side}.`,
      zh: `${key} ${side === 'left' ? '<' : '>'} ${n.key}：往${SIDE_ZH[side]}走。`,
    });
    point(on, at).highlight({ nodes: [at] });
    at = n[side];
  }
  trace.step('missing', {
    en: `Reached an empty spot: ${key} is not in the tree.`,
    zh: `到达空位：${key} 不在树中。`,
  });
  point(on, null);
  return { state: s, result: false };
}

// Equal keys go right.
const INSERT = listing('insert', {
  pseudocode: `
    TREE-INSERT(root, key)
        if root == NIL
            return NEW-NODE(key)  // @root
        node = root
        while TRUE
            if key < node.key  // @go
                if node.left == NIL
                    node.left = NEW-NODE(key)  // @left
                    return root
                node = node.left
            else
                if node.right == NIL
                    node.right = NEW-NODE(key)  // @right
                    return root
                node = node.right
  `,
  python: `
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
  `,
});

function insert(
  s: BstState,
  key: number,
  trace: Trace,
  on: On,
): Applied<BstState> {
  if (s.nodes.size >= MAX_SIZE)
    throw new RangeError(`The tree is full: it holds at most ${MAX_SIZE} keys`);
  const id = `n${s.next}`;
  const added = withNode({ ...s, next: s.next + 1 }, id, {
    key,
    left: null,
    right: null,
  });
  if (s.root === null) {
    trace.step('root', {
      en: `The tree is empty: ${key} becomes the root.`,
      zh: `树是空的：${key} 成为根。`,
    });
    on.addNode({ node: { id, value: key }, parent: null });
    return { state: { ...added, root: id }, result: null };
  }
  for (let at = s.root; ;) {
    const n = nodeOf(s, at);
    const side: Side = key < n.key ? 'left' : 'right';
    trace.step('go', {
      en: `${key} ${side === 'left' ? '<' : '≥'} ${n.key}: go ${side}.`,
      zh: `${key} ${side === 'left' ? '<' : '≥'} ${n.key}：往${SIDE_ZH[side]}走。`,
    });
    point(on, at).highlight({ nodes: [at] });
    const next = n[side];
    if (next === null) {
      trace.step(side, {
        en: `Empty spot: insert ${key} as the ${side} child of ${n.key}.`,
        zh: `空位：把 ${key} 插入为 ${n.key} 的${SIDE_ZH[side]}孩子。`,
      });
      on.addNode({ node: { id, value: key }, parent: at, slot: side });
      point(on, null);
      return { state: withNode(added, at, { ...n, [side]: id }), result: null };
    }
    at = next;
  }
}

const deleteCode = (by: 'successor' | 'predecessor') => {
  const [near, far, name] =
    by === 'successor' ? ['right', 'left', 'succ'] : ['left', 'right', 'pred'];
  return listing(by === 'successor' ? 'delete' : 'delete-by-predecessor', {
    pseudocode: `
      TREE-DELETE(node, key)
          if node == NIL
              return NIL  // @missing
          if key < node.key
              node.left = TREE-DELETE(node.left, key)  // @left
          elseif key > node.key
              node.right = TREE-DELETE(node.right, key)  // @right
          elseif node.left == NIL
              return node.right  // @no-left
          elseif node.right == NIL
              return node.left  // @no-right
          else
              ${name} = node.${near}  // @replacement
              while ${name}.${far} ≠ NIL
                  ${name} = ${name}.${far}
              node.key = ${name}.key  // @copy
              node.${near} = TREE-DELETE(node.${near}, ${name}.key)  // @remove
          return node
    `,
    python: `
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
    `,
  });
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
function splice(on: On, id: string, child: string | null, place: Place) {
  point(on, null);
  if (child !== null) {
    if (place === null) on.detach({ node: child });
    else on.setChild({ parent: place.parent, child, slot: place.side });
  }
  on.removeNode({ node: id });
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
  trace: Trace,
  on: On,
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
  trace.step('replacement', {
    en: `${n.key} has two children: its ${by} ${key} is the ${where} subtree.`,
    zh: `${n.key} 有两个孩子：它的${by === 'successor' ? '后继' : '前驱'} ${key} 是${by === 'successor' ? '右子树中最小的关键字' : '左子树中最大的关键字'}。`,
  });
  point(on, at)
    .pointer({ name: by === 'successor' ? 'succ' : 'pred', node: r })
    .highlight({ nodes: [r] });
  trace.step('copy', {
    en: `Copy ${key} into the node.`,
    zh: `把 ${key} 复制到这个节点。`,
  });
  on.setValue({ node: at, value: key });
  trace.step('remove', {
    en: `Now delete the old ${key} from the ${near} subtree.`,
    zh: `再从${SIDE_ZH[near]}子树中删除原来的 ${key}。`,
  });
  on.pointer({ name: by === 'successor' ? 'succ' : 'pred', node: null });
  const copied = withNode(s, at, { ...n, key });
  const d = del(
    copied,
    n[near],
    key,
    { parent: at, side: near },
    by,
    trace,
    on,
  );
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
  trace: Trace,
  on: On,
): Deleted {
  if (at === null) {
    trace.step('missing', {
      en: `Reached an empty spot: ${key} is not in the tree.`,
      zh: `到达空位：${key} 不在树中。`,
    });
    point(on, null);
    return { state: s, sub: null, found: false };
  }
  const n = nodeOf(s, at);
  if (key !== n.key) {
    const side: Side = key < n.key ? 'left' : 'right';
    trace.step(side, {
      en: `${key} ${side === 'left' ? '<' : '>'} ${n.key}: delete from the ${side} subtree.`,
      zh: `${key} ${side === 'left' ? '<' : '>'} ${n.key}：在${SIDE_ZH[side]}子树中删除。`,
    });
    point(on, at).highlight({ nodes: [at] });
    const d = del(s, n[side], key, { parent: at, side }, by, trace, on);
    const state = withNode(d.state, at, {
      ...nodeOf(d.state, at),
      [side]: d.sub,
    });
    return { state, sub: at, found: d.found };
  }
  if (n.left !== null && n.right !== null)
    return replaceAndDelete(s, at, by, trace, on);
  const [anchor, child] =
    n.left === null ? ['no-left', n.right] : ['no-right', n.left];
  trace.step(
    anchor,
    child === null
      ? { en: `${key} is a leaf: remove it.`, zh: `${key} 是叶子：删去它。` }
      : {
          en: `${key} has one child: its subtree takes the node's place.`,
          zh: `${key} 只有一个孩子：它的子树取代这个节点。`,
        },
  );
  point(on, at).highlight({ nodes: [at] });
  splice(on, at, child, place);
  return { state: removeNode(s, at), sub: child, found: true };
}

function preorder(s: BstState, id: string | null): string[] {
  if (id === null) return [];
  const n = nodeOf(s, id);
  return [id, ...preorder(s, n.left), ...preorder(s, n.right)];
}

type From = readonly number[];

const op = operationsOf<BstState, From, 'tree'>();
const Key = z.number().describe('A key.');
const sample = [8, 3, 10, 1, 6, 14, 4, 7, 13];

const searchOp = op({
  name: 'search',
  title: { en: 'search', zh: '查找' },
  summary: {
    en: 'Searches for a key from the root, going left or right at each node.',
    zh: '从根开始查找一个关键字，在每个节点往左或往右走。',
  },
  args: { key: Key.describe('The key to look for.') },
  examples: [{ from: sample, key: 7 }],
  code: SEARCH,
  titleOf: ({ key }) => ({ en: `search ${key}`, zh: `查找 ${key}` }),
  apply: (s, { key }, trace, on) => search(s, key, trace, on),
});

const insertOp = op({
  name: 'insert',
  title: { en: 'insert', zh: '插入' },
  summary: {
    en: 'Inserts a key at the empty spot a search for it reaches; equal keys go right.',
    zh: '把关键字插入到查找它时到达的空位；相等的关键字放到右边。',
  },
  args: { key: Key.describe('The key to insert.') },
  examples: [{ from: sample, key: 5 }],
  code: INSERT,
  titleOf: ({ key }) => ({ en: `insert ${key}`, zh: `插入 ${key}` }),
  apply: (s, { key }, trace, on) => insert(s, key, trace, on),
});

const deleteOp = op({
  name: 'delete',
  title: { en: 'delete', zh: '删除' },
  summary: {
    en: 'Deletes a key; a node with two children takes the key of its successor (or predecessor), which is then deleted.',
    zh: '删除一个关键字；有两个孩子的节点改存它后继（或前驱）的关键字，再删除那个后继（或前驱）。',
  },
  args: {
    key: Key.describe('The key to delete.'),
    replaceWith: z
      .enum(['successor', 'predecessor'])
      .optional()
      .describe('For a node with two children; default "successor".'),
  },
  examples: [
    { from: sample, key: 3 },
    { from: sample, key: 8, replaceWith: 'predecessor' },
  ],
  code: DELETE.successor,
  codeOf: ({ replaceWith }) => DELETE[replaceWith ?? 'successor'],
  titleOf: ({ key }) => ({ en: `delete ${key}`, zh: `删除 ${key}` }),
  apply(s, { key, replaceWith }, trace, on) {
    const d = del(s, s.root, key, null, replaceWith ?? 'successor', trace, on);
    return { state: { ...d.state, root: d.sub }, result: d.found };
  },
});

/** Operations on a binary search tree given as keys in insertion order. */
export const bst = defineStructure<BstState, From, 'tree'>({
  id: 'bst',
  title: { en: 'Binary search tree', zh: '二叉搜索树' },
  topic: 'trees',
  summary: {
    en: 'Searches, inserts and deletes keys one after another in a binary search tree.',
    zh: '在二叉搜索树中依次查找、插入和删除关键字。',
  },
  name: 'bst',
  kind: 'tree',
  from: listField(
    z
      .array(z.number())
      .max(MAX_SIZE)
      .describe(
        'Keys in insertion order that build the starting tree, e.g. [8, 3, 10, 1, 6].',
      ),
    'number',
  ),
  examples: [
    {
      from: [8, 3, 10, 1, 6, 14],
      ops: [
        { op: 'insert', key: 4 },
        { op: 'search', key: 6 },
        { op: 'delete', key: 3 },
      ],
    },
    {
      // A whole life: insert the keys one by one, then search.
      from: [],
      ops: [
        ...[5, 3, 8, 1, 4, 9, 7].map((key) => ({ op: 'insert', key })),
        { op: 'search', key: 4 },
      ],
    },
  ],
  start(from) {
    const trace = silentTrace();
    const on = silentHandle('tree');
    return from.reduce((s, key) => insert(s, key, trace, on).state, EMPTY);
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
  clear(on) {
    on.pointer({ name: 'curr', node: null });
  },
  operations: [searchOp, insertOp, deleteOp],
});
