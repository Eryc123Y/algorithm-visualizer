/**
 * Recipes on trees: binary search trees, AVL trees, traversals, binary
 * heaps, tries and union–find.
 */
import type { VisualizationInput } from '@algoviz/spec';

import { Recorder } from './recorder.ts';
import { python } from './source.ts';

interface BstNode {
  readonly id: string;
  readonly key: number;
  left: BstNode | null;
  right: BstNode | null;
  height: number;
}

/** Inserts keys into a binary search tree one by one, then searches. */
export function bstInsert(
  keys: readonly number[],
  search?: number,
): VisualizationInput {
  const r = new Recorder({
    title: 'Binary search tree',
    source: python(`
      def insert(root, key):
          if root is None:
              return Node(key)
          if key < root.key:
              root.left = insert(root.left, key)
          else:
              root.right = insert(root.right, key)
          return root
    `),
  });
  const tree = r.add('bst', { kind: 'tree', binary: true });
  let root: BstNode | null = null;
  keys.forEach((key, k) => {
    const node: BstNode = {
      id: `n${k}`,
      key,
      left: null,
      right: null,
      height: 1,
    };
    if (root === null) {
      r.step({
        line: 3,
        narration: `The tree is empty: ${key} becomes the root.`,
      });
      tree.addNode({ node: { id: node.id, value: key }, parent: null });
      root = node;
      return;
    }
    let at: BstNode = root;
    for (;;) {
      const left = key < at.key;
      r.step({
        line: left ? 5 : 7,
        narration: `${key} ${left ? '<' : '≥'} ${at.key}: go ${left ? 'left' : 'right'}.`,
      });
      tree.pointer({ name: 'curr', node: at.id }).highlight({ nodes: [at.id] });
      const next = left ? at.left : at.right;
      if (next === null) {
        r.step({
          line: 3,
          narration: `Empty spot: insert ${key} as the ${left ? 'left' : 'right'} child of ${at.key}.`,
        });
        tree.addNode({
          node: { id: node.id, value: key },
          parent: at.id,
          slot: left ? 'left' : 'right',
        });
        tree.pointer({ name: 'curr', node: null });
        if (left) at.left = node;
        else at.right = node;
        break;
      }
      at = next;
    }
  });
  if (search !== undefined) {
    let at = root as BstNode | null;
    while (at !== null) {
      r.step({ narration: `Search ${search}: compare with ${at.key}.` });
      tree.pointer({ name: 'curr', node: at.id }).visit({ node: at.id });
      if (at.key === search) {
        r.step({ narration: `Found ${search}.` });
        tree.settle({ node: at.id });
        return r.build();
      }
      at = search < at.key ? at.left : at.right;
    }
    r.step({
      narration: `Reached an empty spot: ${search} is not in the tree.`,
    });
    tree.pointer({ name: 'curr', node: null });
  }
  return r.build();
}

/** Inserts keys into an AVL tree, rebalancing with rotations. */
export function avlInsert(keys: readonly number[]): VisualizationInput {
  const r = new Recorder({
    title: 'AVL tree',
    source: python(`
      def insert(node, key):
          if node is None: return Node(key)
          if key < node.key: node.left = insert(node.left, key)
          else: node.right = insert(node.right, key)
          update_height(node)
          b = balance(node)            # height(left) - height(right)
          if b > 1 and key >= node.left.key:
              node.left = rotate_left(node.left)
          if b > 1: return rotate_right(node)
          if b < -1 and key < node.right.key:
              node.right = rotate_right(node.right)
          if b < -1: return rotate_left(node)
          return node
    `),
  });
  const tree = r.add('avl', { kind: 'tree', binary: true });
  const h = (n: BstNode | null) => n?.height ?? 0;
  const fix = (n: BstNode) => {
    n.height = 1 + Math.max(h(n.left), h(n.right));
    tree.annotate({ node: n.id, text: `h=${n.height}` });
  };
  const rotateLeft = (x: BstNode): BstNode => {
    const y = x.right!;
    tree.rotate({ node: x.id, direction: 'left' });
    x.right = y.left;
    y.left = x;
    fix(x);
    fix(y);
    return y;
  };
  const rotateRight = (x: BstNode): BstNode => {
    const y = x.left!;
    tree.rotate({ node: x.id, direction: 'right' });
    x.left = y.right;
    y.right = x;
    fix(x);
    fix(y);
    return y;
  };
  let count = 0;
  const insert = (
    node: BstNode | null,
    key: number,
    parent: BstNode | null,
    side: 'left' | 'right',
  ): BstNode => {
    if (node === null) {
      const fresh: BstNode = {
        id: `n${count++}`,
        key,
        left: null,
        right: null,
        height: 1,
      };
      r.step({ line: 2, narration: `Insert ${key} here.` });
      tree.addNode({
        node: { id: fresh.id, value: key },
        parent: parent?.id ?? null,
        ...(parent ? { slot: side } : {}),
      });
      tree.annotate({ node: fresh.id, text: 'h=1' });
      return fresh;
    }
    const left = key < node.key;
    r.step({
      line: left ? 3 : 4,
      narration: `${key} ${left ? '<' : '≥'} ${node.key}: go ${left ? 'left' : 'right'}.`,
    });
    tree.highlight({ nodes: [node.id] });
    if (left) node.left = insert(node.left, key, node, 'left');
    else node.right = insert(node.right, key, node, 'right');
    const b = h(node.left) - h(node.right);
    r.step({ line: 6, narration: `Back at ${node.key}: balance ${b}.` });
    fix(node);
    tree.highlight({ nodes: [node.id] });
    if (b > 1) {
      if (key >= node.left!.key) {
        r.step({
          line: 8,
          narration: `Left–right case: rotate ${node.left!.key} left first.`,
        });
        node.left = rotateLeft(node.left!);
      }
      r.step({ line: 9, narration: `Left-heavy: rotate ${node.key} right.` });
      return rotateRight(node);
    }
    if (b < -1) {
      if (key < node.right!.key) {
        r.step({
          line: 11,
          narration: `Right–left case: rotate ${node.right!.key} right first.`,
        });
        node.right = rotateRight(node.right!);
      }
      r.step({ line: 12, narration: `Right-heavy: rotate ${node.key} left.` });
      return rotateLeft(node);
    }
    return node;
  };
  let root: BstNode | null = null;
  // Equal keys go right, as in the code shown.
  for (const key of keys) root = insert(root, key, null, 'left');
  r.step('Every node is balanced: heights differ by at most one.');
  return r.build();
}

export type TraversalOrder = 'preorder' | 'inorder' | 'postorder';

/** Depth-first traversal of a binary tree given in level order. */
export function treeTraversal(
  levelOrder: readonly (number | null)[],
  order: TraversalOrder,
): VisualizationInput {
  const body = {
    preorder: ['visit(node)', 'traverse(node.left)', 'traverse(node.right)'],
    inorder: ['traverse(node.left)', 'visit(node)', 'traverse(node.right)'],
    postorder: ['traverse(node.left)', 'traverse(node.right)', 'visit(node)'],
  }[order];
  const visitLine = 3 + body.indexOf('visit(node)');
  const r = new Recorder({
    title: `${order[0]!.toUpperCase()}${order.slice(1)} traversal`,
    source: python(`
      def traverse(node):
          if node is None: return
          ${body.join('\n          ')}
    `),
  });
  const tree = r.add('tree', { kind: 'tree', levelOrder: [...levelOrder] });
  const out = r.add('out', { kind: 'array', initial: [] });
  // Rebuild the shape the protocol derives from levelOrder (ids e0, e1, …).
  const children: [number | null, number | null][] = [];
  const queue: number[] = [];
  if (levelOrder.length > 0 && levelOrder[0] !== null) {
    children.push([null, null]);
    queue.push(0);
  }
  let k = 1;
  while (queue.length > 0 && k < levelOrder.length) {
    const parent = queue.shift()!;
    for (const side of [0, 1] as const) {
      if (k >= levelOrder.length) break;
      if (levelOrder[k++] !== null) {
        children.push([null, null]);
        children[parent]![side] = children.length - 1;
        queue.push(children.length - 1);
      }
    }
  }
  const values = levelOrder.filter((v) => v !== null);
  let written = 0;
  const visit = (n: number | null): void => {
    if (n === null) return;
    r.step({ line: 2, narration: `Enter ${values[n]}.` });
    tree.pointer({ name: 'node', node: `e${n}` });
    for (const part of body) {
      if (part === 'visit(node)') {
        r.step({ line: visitLine, narration: `Visit ${values[n]}.` });
        tree.pointer({ name: 'node', node: `e${n}` }).visit({ node: `e${n}` });
        out.insert({
          index: written++,
          element: { id: `o${n}`, value: values[n]! },
        });
      } else visit(children[n]![part.endsWith('left)') ? 0 : 1]);
    }
  };
  visit(children.length > 0 ? 0 : null);
  r.step(`Done: the ${order} sequence is complete.`);
  tree.pointer({ name: 'node', node: null });
  return r.build();
}

/** A binary min-heap: inserts, then extracts every minimum. */
export function binaryHeap(values: readonly number[]): VisualizationInput {
  const r = new Recorder({
    title: 'Binary min-heap',
    source: python(`
      def push(h, x):
          h.append(x)
          i = len(h) - 1
          while i > 0 and h[(i - 1) // 2] > h[i]:
              h[i], h[(i - 1) // 2] = h[(i - 1) // 2], h[i]
              i = (i - 1) // 2

      def pop(h):
          h[0], h[-1] = h[-1], h[0]
          x = h.pop()
          sift_down(h, 0)
          return x
    `),
  });
  const heap = r.add('heap', { kind: 'array', view: 'tree', initial: [] });
  const out = r.add('out', { kind: 'array', initial: [] });
  const h: number[] = [];
  values.forEach((x, k) => {
    r.step({ line: 2, narration: `Push ${x} at the end.` });
    heap.insert({ index: h.length, element: { id: `h${k}`, value: x } });
    h.push(x);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      r.step({
        line: 4,
        narration: `Compare ${h[i]} with its parent ${h[p]}.`,
      });
      heap.compare({ i, j: p });
      if (h[p]! <= h[i]!) break;
      r.step({ line: 5, narration: `${h[i]} < ${h[p]}: swap up.` });
      heap.swap({ i, j: p });
      [h[i], h[p]] = [h[p]!, h[i]!];
      i = p;
    }
  });
  while (h.length > 0) {
    const last = h.length - 1;
    r.step({
      line: 9,
      narration: `Pop the minimum ${h[0]}: swap it with the last element.`,
    });
    heap.swap({ i: 0, j: last });
    [h[0], h[last]] = [h[last]!, h[0]!];
    r.step({ line: 10, narration: `Remove ${h[last]}.` });
    heap.remove({ index: last });
    out.insert({
      index: values.length - h.length,
      element: { id: `o${values.length - h.length}`, value: h.pop()! },
    });
    let i = 0;
    for (;;) {
      const [a, b] = [2 * i + 1, 2 * i + 2];
      if (a >= h.length) break;
      const c = b < h.length && h[b]! < h[a]! ? b : a;
      r.step({
        line: 11,
        narration: `Compare ${h[i]} with its smaller child ${h[c]}.`,
      });
      heap.compare({ i, j: c });
      if (h[i]! <= h[c]!) break;
      r.step({ line: 11, narration: `${h[i]} > ${h[c]}: swap down.` });
      heap.swap({ i, j: c });
      [h[i], h[c]] = [h[c]!, h[i]!];
      i = c;
    }
  }
  r.step('The values came out in ascending order.');
  return r.build();
}

/** Inserts words into a trie; nodes that end a word are settled. */
export function trieInsert(words: readonly string[]): VisualizationInput {
  const r = new Recorder({
    title: 'Trie',
    source: python(`
      def insert(root, word):
          node = root
          for ch in word:
              if ch not in node.children:
                  node.children[ch] = Node()
              node = node.children[ch]
          node.is_word = True
    `),
  });
  interface TrieNode {
    readonly id: string;
    readonly children: Map<string, TrieNode>;
  }
  const trie = r.add('trie', {
    kind: 'tree',
    nodes: [{ id: 'root', value: '' }],
  });
  const root: TrieNode = { id: 'root', children: new Map() };
  let count = 0;
  for (const word of words) {
    r.step({ line: 2, narration: `Insert "${word}".` });
    trie.pointer({ name: 'node', node: 'root' });
    let node = root;
    for (const ch of word) {
      let next = node.children.get(ch);
      if (next === undefined) {
        next = { id: `t${count++}`, children: new Map() };
        // Keep children in alphabetical order.
        const slot = [...node.children.keys()].filter((c) => c < ch).length;
        node.children.set(ch, next);
        r.step({ line: 5, narration: `No child "${ch}": add it.` });
        trie.addNode({
          node: { id: next.id, value: ch },
          parent: node.id,
          slot,
        });
      } else {
        r.step({ line: 6, narration: `Follow the existing child "${ch}".` });
        trie.highlight({ nodes: [next.id] });
      }
      trie.pointer({ name: 'node', node: next.id });
      node = next;
    }
    r.step({ line: 7, narration: `Mark the end of "${word}".` });
    trie.settle({ node: node.id });
  }
  r.step('All words are in the trie; settled nodes end a word.');
  trie.pointer({ name: 'node', node: null });
  return r.build();
}

/** Union–find with union by rank and path compression. */
export function unionFind(
  size: number,
  unions: readonly (readonly [number, number])[],
): VisualizationInput {
  const r = new Recorder({
    title: 'Union–find',
    source: python(`
      def find(x):
          if parent[x] != x:
              parent[x] = find(parent[x])
          return parent[x]

      def union(a, b):
          ra, rb = find(a), find(b)
          if ra == rb: return
          if rank[ra] < rank[rb]: ra, rb = rb, ra
          parent[rb] = ra
          if rank[ra] == rank[rb]: rank[ra] += 1
    `),
  });
  const ids = Array.from({ length: size }, (_, k) => String(k));
  const forest = r.add('sets', {
    kind: 'tree',
    nodes: ids.map((id) => ({ id, value: Number(id) })),
  });
  const parent = Array.from({ length: size }, (_, k) => k);
  const rank = Array.from({ length: size }, () => 0);
  const find = (x: number): number => {
    const path: number[] = [];
    let root = x;
    while (parent[root] !== root) {
      path.push(root);
      root = parent[root]!;
    }
    r.step({
      line: 2,
      narration: `find(${x}): follow parents up to the root ${root}.`,
    });
    forest.highlight({ nodes: [...path, root].map(String) });
    const moved = path.filter((p) => parent[p] !== root);
    if (moved.length > 0) {
      r.step({
        line: 3,
        narration: `Path compression: hang ${moved.join(', ')} directly under ${root}.`,
      });
      for (const p of moved) {
        forest.setChild({ parent: String(root), child: String(p) });
        parent[p] = root;
      }
    }
    return root;
  };
  for (const [a, b] of unions) {
    r.step({ line: 7, narration: `union(${a}, ${b}).` });
    let ra = find(a);
    let rb = find(b);
    if (ra === rb) {
      r.step({
        line: 8,
        narration: `${a} and ${b} are already in the same set.`,
      });
      continue;
    }
    if (rank[ra]! < rank[rb]!) [ra, rb] = [rb, ra];
    r.step({
      line: 10,
      narration: `Hang root ${rb} (rank ${rank[rb]}) under root ${ra} (rank ${rank[ra]}).`,
    });
    forest.setChild({ parent: String(ra), child: String(rb) });
    parent[rb] = ra;
    if (rank[ra] === rank[rb]) {
      rank[ra]!++;
      forest.annotate({ node: String(ra), text: `rank ${rank[ra]}` });
    }
  }
  r.step('Each tree is one set; its root names the set.');
  return r.build();
}
