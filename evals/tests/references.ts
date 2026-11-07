/**
 * A correct document for every task, to show that each check accepts a
 * faithful solution. Recipes provide most; the rest are recorded here.
 */
import * as recipes from '@algoviz/recipes';
import { Recorder } from '@algoviz/recipes';
import type { VisualizationInput } from '@algoviz/spec';

function twoSum(): VisualizationInput {
  const r = new Recorder({ title: 'Two sum' });
  const a = r.add('a', { kind: 'array', initial: [1, 2, 4, 7, 11, 15] });
  const steps: [number, number, string][] = [
    [0, 5, '1 + 15 = 16 > 15: move j left.'],
    [0, 4, '1 + 11 = 12 < 15: move i right.'],
    [1, 4, '2 + 11 = 13 < 15: move i right.'],
    [2, 4, '4 + 11 = 15: found.'],
  ];
  for (const [i, j, text] of steps) {
    r.step(text);
    a.pointer({ name: 'i', index: i }).pointer({ name: 'j', index: j });
    a.compare({ i, j });
  }
  return r.build();
}

function buildMaxHeap(): VisualizationInput {
  const r = new Recorder({ title: 'Build a max-heap' });
  const a = r.add('a', {
    kind: 'array',
    view: 'tree',
    initial: [3, 9, 2, 1, 4, 5],
  });
  r.step('Sift down 2 at index 2: its child 5 is larger, swap.');
  a.swap({ i: 2, j: 5 });
  r.step('9 at index 1 is larger than its children 1 and 4.');
  a.compare({ i: 1, j: 4 });
  r.step('Sift down 3 at the root: 9 is the larger child, swap.');
  a.swap({ i: 0, j: 1 });
  r.step('3 at index 1: its child 4 is larger, swap. Done.');
  a.swap({ i: 1, j: 4 });
  return r.build();
}

function dutchFlag(): VisualizationInput {
  const xs = [2, 0, 2, 1, 1, 0];
  const r = new Recorder({ title: 'Dutch national flag' });
  const a = r.add('a', { kind: 'array', initial: [...xs] });
  let [low, mid, high] = [0, 0, xs.length - 1];
  const show = () =>
    a
      .pointer({ name: 'low', index: low })
      .pointer({ name: 'mid', index: mid })
      .pointer({ name: 'high', index: high });
  r.step('Start with low = mid = 0 and high = 5.');
  show();
  while (mid <= high) {
    const v = xs[mid]!;
    r.step(`a[mid] = ${v}.`);
    if (v === 0) {
      [xs[low], xs[mid]] = [xs[mid]!, xs[low]!];
      a.swap({ i: low, j: mid });
      low++;
      mid++;
    } else if (v === 1) mid++;
    else {
      [xs[mid], xs[high]] = [xs[high]!, xs[mid]!];
      a.swap({ i: mid, j: high });
      high--;
    }
    show();
  }
  return r.build();
}

function postfix(): VisualizationInput {
  const r = new Recorder({ title: 'Postfix evaluation' });
  const s = r.add('s', { kind: 'stack', initial: [] });
  r.step('Push 3.');
  s.push({ element: 3 });
  r.step('Push 4.');
  s.push({ element: 4 });
  r.step('+: pop 4 and 3, push 7.');
  s.pop().pop().push({ element: 7 });
  r.step('Push 2.');
  s.push({ element: 2 });
  r.step('*: pop 2 and 7, push 14.');
  s.pop().pop().push({ element: 14 });
  r.step('Push 7.');
  s.push({ element: 7 });
  r.step('-: pop 7 and 14, push 7.');
  s.pop().pop().push({ element: 7 });
  return r.build();
}

function printerQueue(): VisualizationInput {
  const r = new Recorder();
  const q = r.add('q', { kind: 'queue', initial: [] });
  for (const job of ['A', 'B', 'C']) {
    r.step(`Job ${job} arrives.`);
    q.enqueue({ element: job });
  }
  r.step('The printer finishes A.');
  q.dequeue();
  r.step('Job D arrives.');
  q.enqueue({ element: 'D' });
  r.step('The printer finishes B.');
  q.dequeue();
  return r.build();
}

function slidingWindowMax(): VisualizationInput {
  const xs = [1, 3, -1, -3, 5, 3, 6, 7];
  const k = 3;
  const r = new Recorder({ title: 'Sliding window maximum' });
  const a = r.add('a', { kind: 'array', initial: xs });
  const d = r.add('deque', { kind: 'queue', initial: [] });
  const out = r.add('out', { kind: 'array', initial: [] });
  const dq: number[] = [];
  xs.forEach((x, i) => {
    r.step(`Index ${i}: value ${x}.`);
    a.pointer({ name: 'i', index: i });
    while (dq.length > 0 && dq[0]! <= i - k) {
      dq.shift();
      d.dequeue();
    }
    while (dq.length > 0 && xs[dq.at(-1)!]! <= x) {
      dq.pop();
      d.popBack();
    }
    dq.push(i);
    d.enqueue({ element: i });
    if (i >= k - 1) out.insert({ index: i - k + 1, element: xs[dq[0]!]! });
  });
  return r.build();
}

function deleteNode(): VisualizationInput {
  const r = new Recorder();
  const l = r.add('list', { kind: 'linkedList', initial: [1, 2, 3, 4] });
  r.step('Walk to 2, the node before 3.');
  l.pointer({ name: 'prev', index: 1 });
  r.step("Point 2's next past 3, at 4.");
  l.link({ from: 1, to: 3 });
  r.step('Remove 3.');
  l.remove({ index: 2 });
  return r.build();
}

function floyd(): VisualizationInput {
  const r = new Recorder();
  const l = r.add('list', { kind: 'linkedList', initial: [1, 2, 3, 4, 5] });
  r.step("5's next points back to 3. Both pointers start at 1.");
  l.link({ from: 4, to: 2 });
  l.pointer({ name: 'slow', index: 0 }).pointer({ name: 'fast', index: 0 });
  const moves: [number, number][] = [
    [1, 2],
    [2, 4],
    [3, 3],
  ];
  for (const [slow, fast] of moves) {
    r.step('slow moves one node, fast two.');
    l.pointer({ name: 'slow', index: slow }).pointer({
      name: 'fast',
      index: fast,
    });
  }
  return r.build();
}

function bstDelete(): VisualizationInput {
  const r = new Recorder();
  const t = r.add('bst', { kind: 'tree', levelOrder: [5, 3, 8, 2, 4, 7, 9] });
  // e1 = 3, e4 = 4: the successor of 3 is 4, a leaf.
  r.step('3 has two children; its in-order successor is 4.');
  t.compare({ a: 'e1', b: 'e4' });
  r.step('Copy 4 into the node of 3.');
  t.setValue({ node: 'e1', value: 4 });
  r.step('Remove the old leaf 4.');
  t.removeNode({ node: 'e4' });
  return r.build();
}

function levelOrder(): VisualizationInput {
  const r = new Recorder();
  const t = r.add('tree', {
    kind: 'tree',
    levelOrder: [1, 2, 3, 4, 5, null, 6],
  });
  const q = r.add('q', { kind: 'queue', initial: [] });
  const out = r.add('out', { kind: 'array', initial: [] });
  const children: Record<string, string[]> = {
    e0: ['e1', 'e2'],
    e1: ['e3', 'e4'],
    e2: ['e5'],
  };
  const value: Record<string, number> = {
    e0: 1,
    e1: 2,
    e2: 3,
    e3: 4,
    e4: 5,
    e5: 6,
  };
  r.step('Enqueue the root.');
  q.enqueue({ element: 'e0' });
  const queue = ['e0'];
  let n = 0;
  while (queue.length > 0) {
    const id = queue.shift()!;
    r.step(`Visit ${value[id]}.`);
    q.dequeue();
    t.visit({ node: id });
    out.insert({ index: n++, element: value[id]! });
    for (const c of children[id] ?? []) {
      queue.push(c);
      q.enqueue({ element: c });
    }
  }
  return r.build();
}

function redBlack(): VisualizationInput {
  const r = new Recorder();
  const t = r.add('rb', { kind: 'tree', binary: true });
  r.step('Insert 1 as a black root.');
  t.addNode({ node: { id: 'n1', value: 1 }, parent: null }).setColor({
    node: 'n1',
    color: 'black',
  });
  r.step('Insert 2 as a red right child.');
  t.addNode({
    node: { id: 'n2', value: 2 },
    parent: 'n1',
    slot: 'right',
  }).setColor({ node: 'n2', color: 'red' });
  r.step('Insert 3 as a red right child of 2: red–red.');
  t.addNode({
    node: { id: 'n3', value: 3 },
    parent: 'n2',
    slot: 'right',
  }).setColor({ node: 'n3', color: 'red' });
  r.step('Rotate left at 1 and recolour.');
  t.rotate({ node: 'n1', direction: 'left' })
    .setColor({ node: 'n2', color: 'black' })
    .setColor({ node: 'n1', color: 'red' });
  return r.build();
}

function colouring(): VisualizationInput {
  const r = new Recorder();
  const g = r.add('g', {
    kind: 'graph',
    nodes: ['A', 'B', 'C', 'D', 'E'],
    edges: [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'A'],
      ['C', 'D'],
      ['D', 'E'],
    ],
  });
  const colours = { A: 0, B: 1, C: 2, D: 0, E: 1 } as const;
  for (const [node, group] of Object.entries(colours)) {
    r.step(`${node} gets colour ${group}.`);
    g.group({ node, group });
  }
  return r.build();
}

function coinChange(): VisualizationInput {
  const r = new Recorder();
  const t = r.add('dp', {
    kind: 'table',
    initial: [[0, null, null, null, null, null, null]],
  });
  const dp = [0, 1, 2, 1, 1, 2, 2];
  for (let a = 1; a <= 6; a++) {
    r.step(`Amount ${a} needs ${dp[a]} coins.`);
    t.set({ cell: [0, a], value: dp[a]! });
  }
  return r.build();
}

const cities = (edges: [string, string, number?][]) => ({
  nodes: [...new Set(edges.flatMap(([a, b]) => [a, b]))],
  edges,
});

function linearSearchTwoLanguages(): VisualizationInput {
  const sources = [
    {
      language: 'pseudocode',
      code: 'LINEAR-SEARCH(a, n, x)\n    for i = 0 to n - 1\n        if a[i] == x\n            return i\n    return NIL',
      anchors: { compare: 3, found: 4 },
    },
    {
      language: 'python',
      code: 'def linear_search(a, x):\n    n = len(a)\n    for i in range(n):\n        if a[i] == x:\n            return i\n    return None',
      anchors: { compare: 4, found: 5 },
    },
  ];
  const xs = [4, 2, 7, 9, 1];
  const r = new Recorder({ title: 'Linear search for 9', sources });
  const a = r.add('a', { kind: 'array', initial: xs });
  for (let i = 0; xs[i - 1] !== 9; i++) {
    r.step({
      at: 'compare',
      narration: xs[i] === 9 ? '9 is the value we want.' : `${xs[i]} is not 9.`,
      vars: { i },
    });
    a.pointer({ name: 'i', index: i }).highlight({ indices: [i] });
  }
  r.step({ at: 'found', narration: 'Found 9 at index 3.' });
  a.settle({ index: 3 });
  return r.build();
}

/** A module's document from the registry. */
function moduleDocument(id: string, input: unknown): VisualizationInput {
  const run = recipes.runAlgorithm(id, input);
  if (!run.ok) throw new Error(run.error.map((e) => e.message).join('; '));
  return run.value.document;
}

export const references: Readonly<Record<string, () => VisualizationInput>> = {
  'linear-search-two-languages': linearSearchTwoLanguages,
  'insertion-sort': () =>
    moduleDocument('insertion-sort', { values: [5, 2, 4, 6, 1, 3] }),
  'selection-sort': () =>
    moduleDocument('selection-sort', { values: [29, 10, 14, 37, 13] }),
  'binary-search-miss': () =>
    moduleDocument('binary-search', {
      values: [1, 3, 4, 7, 9, 11, 15],
      target: 6,
    }),
  'two-sum-sorted': twoSum,
  'build-max-heap': buildMaxHeap,
  'dutch-flag': dutchFlag,
  'postfix-eval': postfix,
  'printer-queue': printerQueue,
  'sliding-window-max': slidingWindowMax,
  'reverse-list': () =>
    moduleDocument('reverse-linked-list', { values: [1, 2, 3, 4] }),
  'delete-list-node': deleteNode,
  'floyd-cycle': floyd,
  'bst-delete': bstDelete,
  'avl-rotation': () => recipes.avlInsert([10, 20, 30]),
  'level-order': levelOrder,
  'trie-insert': () => recipes.trieInsert(['to', 'tea', 'ten']),
  'union-find': () =>
    recipes.unionFind(5, [
      [0, 1],
      [2, 3],
      [1, 3],
    ]),
  'red-black-insert': redBlack,
  bfs: () =>
    recipes.breadthFirstSearch(
      cities([
        ['A', 'B'],
        ['A', 'C'],
        ['B', 'D'],
        ['C', 'D'],
        ['D', 'E'],
      ]),
      'A',
    ),
  'topological-sort': () =>
    recipes.topologicalSort({
      directed: true,
      ...cities([
        ['undershorts', 'pants'],
        ['pants', 'shoes'],
        ['pants', 'belt'],
        ['shirt', 'belt'],
        ['shirt', 'tie'],
        ['tie', 'jacket'],
        ['belt', 'jacket'],
        ['socks', 'shoes'],
      ]),
    }),
  dijkstra: () =>
    recipes.dijkstra(
      cities([
        ['S', 'A', 4],
        ['S', 'B', 1],
        ['B', 'A', 2],
        ['A', 'C', 1],
        ['B', 'C', 5],
        ['C', 'D', 3],
      ]),
      'S',
    ),
  kruskal: () =>
    recipes.kruskal(
      cities([
        ['A', 'B', 4],
        ['A', 'C', 3],
        ['B', 'C', 1],
        ['B', 'D', 2],
        ['C', 'D', 4],
        ['D', 'E', 2],
        ['C', 'E', 5],
      ]),
    ),
  'graph-coloring': colouring,
  lcs: () => recipes.longestCommonSubsequence('ABCB', 'BDCAB'),
  'coin-change': coinChange,
  'hash-chaining': () =>
    moduleDocument('hash-chaining', {
      from: { size: 7, keys: [] },
      ops: [15, 11, 27, 8, 12].map((key) => ({ op: 'insert', key })),
    }),
  'linear-probing': () =>
    moduleDocument('linear-probing', {
      from: { size: 13, keys: [] },
      ops: [18, 41, 22, 44, 59, 32, 31, 73].map((key) => ({
        op: 'insert',
        key,
      })),
    }),
};
