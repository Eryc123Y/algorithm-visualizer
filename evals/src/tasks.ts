/**
 * Evaluation tasks: requests a teacher might make, each with a check of
 * what a correct visualization must show. Checks look at states, not at
 * names or wording, so any faithful document passes.
 */
import type { Trace } from '@algoviz/core';
import type { Scalar, StructureKindName } from '@algoviz/spec';

import {
  anyTrack,
  expect,
  hasCycle,
  inorder,
  listOrder,
  nodeIds,
  noteNumbers,
  paths,
  same,
  sortedNumbers,
  subtree,
  tracks,
  treeNode,
  values,
  type Track,
} from './checks.ts';

export interface EvalTask {
  readonly id: string;
  /** Kinds a natural solution uses (documentation only). */
  readonly kinds: readonly StructureKindName[];
  readonly prompt: string;
  /** Fewer steps than this cannot show the algorithm. */
  readonly minSteps: number;
  /** Problems with what the document shows; empty if it is correct. */
  check(trace: Trace): string[];
}

/** A value as a number; numeric strings count, null does not. */
const num = (v: Scalar): number => (v === null ? NaN : Number(v));
const nums = (vs: readonly Scalar[]) => vs.map(num);
const str = (vs: readonly Scalar[]) => vs.map((v) => String(v));

/** An array that starts as `input` and ends sorted ascending. */
const sortsArray =
  (input: readonly number[]) =>
  (trace: Trace): string[] =>
    anyTrack(trace, 'array', (t) => [
      ...expect(
        same(nums(values(t.first)), input),
        `starts as ${JSON.stringify(values(t.first))}`,
      ),
      ...expect(
        same(nums(values(t.last)), sortedNumbers(input)),
        `ends as ${JSON.stringify(values(t.last))}, not sorted`,
      ),
    ]);

/** Whether any frame of an array has at least `n` pointers. */
const hasPointers = (t: Track<'array'>, n: number) =>
  t.states.some((s) => Object.keys(s.marks.pointers).length >= n);

/** The positions a pointer moves through, without repeats in a row. */
const probes = (t: Track<'array'>, name: string) =>
  t.states
    .map((s) => s.marks.pointers[name])
    .filter((k, i, ks) => k !== undefined && k !== ks[i - 1]);

/**
 * Whether a search ends failed with lo at `at`: in the last frame, lo is
 * there and hi, if still shown, is at or below it (inclusive or exclusive).
 */
function failedAt(t: Track<'array'>, at: number): boolean {
  const { lo, hi } = t.last.marks.pointers;
  return lo === at && (hi === undefined || hi <= at);
}

/** Whether a red node has a red child: the violation insertion repairs. */
const redRed = (s: Track<'tree'>['first']) =>
  s.data.nodes.some(
    (n) =>
      n.color === 'red' &&
      n.children.some((c) => c !== null && treeNode(s, c)?.color === 'red'),
  );

const isMaxHeap = (xs: readonly number[]) =>
  xs.every((x, i) => i === 0 || xs[Math.floor((i - 1) / 2)]! >= x);

/** The LCS table of a and b, with the empty-prefix row and column. */
function lcsTable(a: string, b: string): number[][] {
  const L = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0),
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      L[i]![j] =
        a[i - 1] === b[j - 1]
          ? L[i - 1]![j - 1]! + 1
          : Math.max(L[i - 1]![j]!, L[i]![j - 1]!);
  return L;
}

/** A graph whose nodes and edges are exactly these (by endpoints). */
function graphIs(
  t: Track<'graph'>,
  nodes: readonly string[],
  edges: readonly (readonly [string, string, number?])[],
  directed: boolean,
): string[] {
  const g = t.first;
  const key = (a: string, b: string) =>
    directed ? `${a}>${b}` : [a, b].sort().join('|');
  const want = edges.map(([a, b, w]) => `${key(a, b)}:${w ?? ''}`).sort();
  const got = g.data.edges
    .map(
      (e) =>
        `${key(e.from, e.to)}:${typeof e.weight === 'number' ? e.weight : ''}`,
    )
    .sort();
  return [
    ...expect(
      g.directed === directed,
      directed ? 'is not directed' : 'is directed',
    ),
    ...expect(
      same(sortedNodes(g), [...nodes].sort()),
      `has nodes ${JSON.stringify(sortedNodes(g))}`,
    ),
    ...expect(same(got, want), `has edges ${JSON.stringify(got)}`),
  ];
}
const sortedNodes = (g: Track<'graph'>['first']) => [...nodeIds(g)].sort();

export const tasks: readonly EvalTask[] = [
  {
    id: 'insertion-sort',
    kinds: ['array'],
    prompt:
      'Insertion sort on [5, 2, 4, 6, 1, 3]. Show each comparison and each move.',
    minSteps: 8,
    check: sortsArray([5, 2, 4, 6, 1, 3]),
  },
  {
    id: 'selection-sort',
    kinds: ['array'],
    prompt:
      'Selection sort on [29, 10, 14, 37, 13]: find the minimum of the unsorted part, swap it into place, and mark the sorted part.',
    minSteps: 6,
    check: sortsArray([29, 10, 14, 37, 13]),
  },
  {
    id: 'binary-search-miss',
    kinds: ['array'],
    prompt:
      'Binary search for 6 in [1, 3, 4, 7, 9, 11, 15] with pointers lo, mid and hi, ending when the search fails.',
    minSteps: 3,
    check: (trace) =>
      anyTrack(trace, 'array', (t) => [
        ...expect(
          same(nums(values(t.first)), [1, 3, 4, 7, 9, 11, 15]),
          'wrong input',
        ),
        ...expect(
          t.states.every((s) => same(values(s), values(t.first))),
          'changes the array',
        ),
        ...expect(
          same(probes(t, 'mid'), [3, 1, 2]),
          `mid probes ${JSON.stringify(probes(t, 'mid'))}, not 7, 3 and 4 (indices 3, 1, 2)`,
        ),
        ...expect(failedAt(t, 3), 'does not end with lo at 3 and hi below it'),
      ]),
  },
  {
    id: 'two-sum-sorted',
    kinds: ['array'],
    prompt:
      'Two pointers: find two numbers in the sorted array [1, 2, 4, 7, 11, 15] that add up to 15, moving pointers i (from the left) and j (from the right).',
    minSteps: 3,
    check: (trace) =>
      anyTrack(trace, 'array', (t) => {
        const xs = nums(values(t.last));
        const at = (ids: readonly number[]) => ids.map((k) => xs[k]!);
        const pointed = [...new Set(Object.values(t.last.marks.pointers))];
        const settled = t.last.data
          .filter((e) => t.last.marks.settled.includes(e.id))
          .map((e) => num(e.value));
        const pair =
          (pointed.length === 2 && at(pointed)) ||
          (settled.length === 2 && settled);
        return [
          ...expect(same(xs, [1, 2, 4, 7, 11, 15]), 'wrong array'),
          ...expect(
            pair !== false && same(sortedNumbers(pair), [4, 11]),
            'does not end with the pair 4 and 11 pointed at or settled',
          ),
        ];
      }),
  },
  {
    id: 'build-max-heap',
    kinds: ['array'],
    prompt:
      'Build a max-heap from [3, 9, 2, 1, 4, 5] in place: sift down from the last parent back to the root. Draw the array as a tree.',
    minSteps: 4,
    check: (trace) =>
      anyTrack(trace, 'array', (t) => {
        const decl = trace.visualization.structures[t.name];
        const xs = nums(values(t.last));
        return [
          ...expect(
            decl?.kind === 'array' && decl.view === 'tree',
            'not drawn as a tree',
          ),
          ...expect(
            same(nums(values(t.first)), [3, 9, 2, 1, 4, 5]),
            'wrong input',
          ),
          ...expect(
            same(sortedNumbers(xs), [1, 2, 3, 4, 5, 9]) && isMaxHeap(xs),
            `ends as ${JSON.stringify(xs)}, not a max-heap of the input`,
          ),
        ];
      }),
  },
  {
    id: 'dutch-flag',
    kinds: ['array'],
    prompt:
      'Dutch national flag partition of [2, 0, 2, 1, 1, 0] in one pass with three pointers low, mid and high, using swaps.',
    minSteps: 5,
    check: (trace) => [
      ...sortsArray([2, 0, 2, 1, 1, 0])(trace),
      ...anyTrack(trace, 'array', (t) =>
        expect(hasPointers(t, 3), 'never shows three pointers'),
      ),
    ],
  },
  {
    id: 'postfix-eval',
    kinds: ['stack'],
    prompt: 'Evaluate the postfix expression "3 4 + 2 * 7 -" with a stack.',
    minSteps: 7,
    check: (trace) =>
      anyTrack(trace, 'stack', (t) => [
        ...expect(
          same(nums(values(t.last)), [7]),
          `ends as ${JSON.stringify(values(t.last))}, not [7]`,
        ),
        ...expect(
          t.states.some((s) => s.data.length >= 2),
          'never holds two operands',
        ),
      ]),
  },
  {
    id: 'printer-queue',
    kinds: ['queue'],
    prompt:
      'A printer queue starts empty. Jobs A, B and C arrive in that order, the printer finishes a job, job D arrives, and the printer finishes another job.',
    minSteps: 4,
    check: (trace) =>
      anyTrack(trace, 'queue', (t) => [
        ...expect(t.first.data.length === 0, 'does not start empty'),
        ...expect(
          same(str(values(t.last)), ['C', 'D']),
          `ends as ${JSON.stringify(values(t.last))}, not [C, D]`,
        ),
      ]),
  },
  {
    id: 'sliding-window-max',
    kinds: ['array', 'queue'],
    prompt:
      'Sliding window maximum of [1, 3, -1, -3, 5, 3, 6, 7] with window size 3, using a deque of indices kept in decreasing order of value. Collect the maxima in an output array.',
    minSteps: 8,
    check: (trace) => [
      ...anyTrack(trace, 'queue', (t) =>
        expect(
          t.states.some((s) => s.data.length >= 2),
          'the deque never holds two indices',
        ),
      ),
      ...anyTrack(trace, 'array', (t) => {
        const out = nums(values(t.last).filter((v) => v !== null && v !== ''));
        return expect(
          same(out, [3, 3, 5, 5, 6, 7]),
          `output is ${JSON.stringify(out)}`,
        );
      }),
    ],
  },
  {
    id: 'reverse-list',
    kinds: ['linkedList'],
    prompt:
      'Reverse the singly linked list 1 → 2 → 3 → 4 in place with pointers prev, curr and next.',
    minSteps: 4,
    check: (trace) =>
      anyTrack(trace, 'linkedList', (t) => [
        ...expect(same(nums(listOrder(t.first)), [1, 2, 3, 4]), 'wrong input'),
        ...expect(
          same(nums(listOrder(t.last)), [4, 3, 2, 1]),
          `ends as ${JSON.stringify(listOrder(t.last))}`,
        ),
      ]),
  },
  {
    id: 'delete-list-node',
    kinds: ['linkedList'],
    prompt:
      'Delete the node with value 3 from the singly linked list 1 → 2 → 3 → 4: find it, then unlink it.',
    minSteps: 3,
    check: (trace) =>
      anyTrack(trace, 'linkedList', (t) => [
        ...expect(same(nums(listOrder(t.first)), [1, 2, 3, 4]), 'wrong input'),
        ...expect(
          same(nums(listOrder(t.last)), [1, 2, 4]),
          `ends as ${JSON.stringify(listOrder(t.last))}`,
        ),
      ]),
  },
  {
    id: 'floyd-cycle',
    kinds: ['linkedList'],
    prompt:
      "The singly linked list 1 → 2 → 3 → 4 → 5 has a cycle: 5's next points back to 3. Detect it with Floyd's tortoise and hare, using pointers slow and fast, until they meet.",
    minSteps: 3,
    check: (trace) =>
      anyTrack(trace, 'linkedList', (t) => [
        ...expect(t.states.some(hasCycle), 'never has the cycle'),
        ...expect(
          t.states.some((s) => {
            const at = Object.values(s.marks.pointers);
            const met = at.find((id, k) => at.indexOf(id) !== k);
            return (
              met !== undefined &&
              num(s.data.find((n) => n.id === met)!.value) === 4
            );
          }),
          'the pointers never meet at 4',
        ),
      ]),
  },
  {
    id: 'bst-delete',
    kinds: ['tree'],
    prompt:
      'Build the binary search tree from the keys 5, 3, 8, 2, 4, 7, 9 (inserted in that order), then delete 3, which has two children, by replacing it with its in-order successor.',
    minSteps: 3,
    check: (trace) =>
      anyTrack(trace, 'tree', (t) => {
        const roots = t.last.data.roots;
        const order =
          roots.length === 1 ? nums(inorder(t.last, roots[0]!)) : [];
        return [
          ...expect(
            t.states.some((s) => s.data.nodes.some((n) => num(n.value) === 3)),
            'never holds 3',
          ),
          ...expect(roots.length === 1, `ends with ${roots.length} roots`),
          ...expect(
            same(order, [2, 4, 5, 7, 8, 9]),
            `ends with in-order ${JSON.stringify(order)}`,
          ),
          ...expect(
            t.last.data.nodes.length === 6,
            `ends with ${t.last.data.nodes.length} nodes`,
          ),
        ];
      }),
  },
  {
    id: 'avl-rotation',
    kinds: ['tree'],
    prompt:
      'Insert 10, 20 and 30 into an empty AVL tree, showing the balance factors and the rotation that rebalances it.',
    minSteps: 4,
    check: (trace) =>
      anyTrack(trace, 'tree', (t) => {
        const [root] = t.last.data.roots;
        return [
          ...expect(t.last.data.roots.length === 1, 'does not end as one tree'),
          ...expect(
            root !== undefined && num(treeNode(t.last, root)!.value) === 20,
            'root is not 20',
          ),
          ...expect(
            root !== undefined &&
              same(nums(inorder(t.last, root)), [10, 20, 30]),
            'is not 10 < 20 > 30',
          ),
          ...expect(
            t.states.some(
              (s) =>
                s.data.roots.length === 1 &&
                num(treeNode(s, s.data.roots[0]!)!.value) === 10 &&
                s.data.nodes.length === 3,
            ),
            'never shows the unbalanced chain',
          ),
        ];
      }),
  },
  {
    id: 'level-order',
    kinds: ['tree', 'queue', 'array'],
    prompt:
      'Level-order traversal of the binary tree [1, 2, 3, 4, 5, null, 6] (given in LeetCode level order) using a queue. Mark nodes as visited and collect the output in an array.',
    minSteps: 6,
    check: (trace) => [
      ...anyTrack(trace, 'tree', (t) => {
        const marked = new Set([
          ...t.last.marks.visited,
          ...t.last.marks.settled,
        ]);
        return [
          ...expect(t.last.data.nodes.length === 6, 'does not have 6 nodes'),
          ...expect(
            marked.size === 6,
            `ends with ${marked.size} of 6 nodes visited`,
          ),
        ];
      }),
      ...anyTrack(trace, 'queue', (t) =>
        expect(
          t.states.some((s) => s.data.length > 0),
          'the queue is never used',
        ),
      ),
      ...anyTrack(trace, 'array', (t) =>
        expect(
          same(
            nums(values(t.last).filter((v) => v !== null)),
            [1, 2, 3, 4, 5, 6],
          ),
          `output is ${JSON.stringify(values(t.last))}`,
        ),
      ),
    ],
  },
  {
    id: 'trie-insert',
    kinds: ['tree'],
    prompt:
      'Insert the words "to", "tea" and "ten" into a trie, one letter at a time.',
    minSteps: 3,
    check: (trace) =>
      anyTrack(trace, 'tree', (t) => {
        const isLetter = (v: Scalar) =>
          typeof v === 'string' && /^[a-z]$/i.test(v);
        const words = t.last.data.roots
          .flatMap((r) => paths(t.last, r))
          .map((p) => p.filter(isLetter).join('').toLowerCase())
          .sort();
        const letters = t.last.data.nodes.filter((n) =>
          isLetter(n.value),
        ).length;
        return [
          ...expect(
            same(words, ['tea', 'ten', 'to']),
            `spells ${JSON.stringify(words)}`,
          ),
          ...expect(
            letters === 5,
            `has ${letters} letter nodes, not 5 (shared prefixes)`,
          ),
        ];
      }),
  },
  {
    id: 'union-find',
    kinds: ['tree'],
    prompt:
      'Union–find over the elements 0 to 4 with union by rank: union(0, 1), union(2, 3), then union(1, 3). Draw the sets as a forest.',
    minSteps: 3,
    check: (trace) =>
      anyTrack(trace, 'tree', (t) => {
        const sets = t.last.data.roots
          .map((r) =>
            subtree(t.last, r)
              .map((id) => String(treeNode(t.last, id)!.value))
              .sort()
              .join(','),
          )
          .sort();
        return [
          ...expect(
            t.first.data.roots.length === 5,
            'does not start as five singletons',
          ),
          ...expect(
            same(sets, ['0,1,2,3', '4']),
            `ends with sets ${JSON.stringify(sets)}`,
          ),
        ];
      }),
  },
  {
    id: 'red-black-insert',
    kinds: ['tree'],
    prompt:
      'Insert 1, 2 and 3 into an empty red–black tree, showing the node colours and the rotation and recolouring that fix the red–red violation.',
    minSteps: 4,
    check: (trace) =>
      anyTrack(trace, 'tree', (t) => {
        const [root] = t.last.data.roots;
        const node = root === undefined ? undefined : treeNode(t.last, root);
        const kids = node?.children.map((c) => treeNode(t.last, c)) ?? [];
        return [
          ...expect(
            num(node?.value ?? null) === 2 && node?.color === 'black',
            'root is not a black 2',
          ),
          ...expect(
            kids.length === 2 &&
              kids.every((k) => k?.color === 'red') &&
              same(nums(kids.map((k) => k?.value ?? null)), [1, 3]),
            'children are not red 1 and red 3',
          ),
          ...expect(t.first.data.nodes.length === 0, 'does not start empty'),
          ...expect(t.states.some(redRed), 'never shows the red–red violation'),
        ];
      }),
  },
  {
    id: 'bfs',
    kinds: ['graph', 'queue'],
    prompt:
      'Breadth-first search from A on the undirected graph with edges A–B, A–C, B–D, C–D and D–E. Show the queue.',
    minSteps: 5,
    check: (trace) => [
      ...anyTrack(trace, 'graph', (t) => {
        const marked = new Set([
          ...t.last.marks.visited,
          ...t.last.marks.settled,
        ]);
        return [
          ...graphIs(
            t,
            ['A', 'B', 'C', 'D', 'E'],
            [
              ['A', 'B'],
              ['A', 'C'],
              ['B', 'D'],
              ['C', 'D'],
              ['D', 'E'],
            ],
            false,
          ),
          ...expect(
            marked.size === 5,
            `ends with ${marked.size} of 5 nodes visited`,
          ),
        ];
      }),
      ...anyTrack(trace, 'queue', (t) =>
        expect(
          t.states.some((s) => s.data.length > 0),
          'the queue is never used',
        ),
      ),
    ],
  },
  {
    id: 'topological-sort',
    kinds: ['graph', 'array'],
    prompt:
      "Topological sort with Kahn's algorithm of the directed graph undershorts → pants, pants → shoes, pants → belt, shirt → belt, shirt → tie, tie → jacket, belt → jacket, socks → shoes. Collect the order in an array.",
    minSteps: 8,
    check: (trace) => {
      const edges = [
        ['undershorts', 'pants'],
        ['pants', 'shoes'],
        ['pants', 'belt'],
        ['shirt', 'belt'],
        ['shirt', 'tie'],
        ['tie', 'jacket'],
        ['belt', 'jacket'],
        ['socks', 'shoes'],
      ] as const;
      const nodes = [...new Set(edges.flat())];
      return [
        ...anyTrack(trace, 'graph', (t) => graphIs(t, nodes, edges, true)),
        ...anyTrack(trace, 'array', (t) => {
          const order = str(values(t.last).filter((v) => v !== null));
          const at = (n: string) => order.indexOf(n);
          return [
            ...expect(
              same([...order].sort(), [...nodes].sort()),
              `output is ${JSON.stringify(order)}`,
            ),
            ...expect(
              edges.every(([a, b]) => at(a) < at(b)),
              'output is not a topological order',
            ),
          ];
        }),
      ];
    },
  },
  {
    id: 'dijkstra',
    kinds: ['graph'],
    prompt:
      "Dijkstra's shortest paths from S on the undirected graph with edges S–A (4), S–B (1), B–A (2), A–C (1), B–C (5) and C–D (3). Show each node's tentative distance next to it.",
    minSteps: 5,
    check: (trace) =>
      anyTrack(trace, 'graph', (t) => {
        const want = { S: 0, A: 3, B: 1, C: 4, D: 7 };
        const notes = noteNumbers(t.last);
        const wrong = Object.entries(want).filter(
          ([n, d]) => notes.get(n) !== d,
        );
        return [
          ...graphIs(
            t,
            Object.keys(want),
            [
              ['S', 'A', 4],
              ['S', 'B', 1],
              ['B', 'A', 2],
              ['A', 'C', 1],
              ['B', 'C', 5],
              ['C', 'D', 3],
            ],
            false,
          ),
          ...expect(
            wrong.length === 0,
            `final distances wrong at ${wrong.map(([n]) => n).join(', ')}`,
          ),
        ];
      }),
  },
  {
    id: 'kruskal',
    kinds: ['graph'],
    prompt:
      "Kruskal's minimum spanning tree of the undirected graph with edges A–B (4), A–C (3), B–C (1), B–D (2), C–D (4), D–E (2) and C–E (5). Mark the edges taken and the ones rejected.",
    minSteps: 5,
    check: (trace) =>
      anyTrack(trace, 'graph', (t) => {
        const taken = t.last.data.edges.filter(
          (e) => t.last.marks.edgeMarks[e.id] === 'selected',
        );
        const weight = taken.reduce((sum, e) => sum + Number(e.weight), 0);
        return [
          ...graphIs(
            t,
            ['A', 'B', 'C', 'D', 'E'],
            [
              ['A', 'B', 4],
              ['A', 'C', 3],
              ['B', 'C', 1],
              ['B', 'D', 2],
              ['C', 'D', 4],
              ['D', 'E', 2],
              ['C', 'E', 5],
            ],
            false,
          ),
          ...expect(
            taken.length === 4 && weight === 8,
            `selects ${taken.length} edges of weight ${weight}, not 4 of weight 8`,
          ),
        ];
      }),
  },
  {
    id: 'graph-coloring',
    kinds: ['graph'],
    prompt:
      'Greedy colouring of the undirected graph with edges A–B, B–C, C–A, C–D and D–E: visit the nodes in alphabetical order and give each the smallest colour not used by a neighbour. Show colours as groups.',
    minSteps: 5,
    check: (trace) =>
      anyTrack(trace, 'graph', (t) => {
        const { groups } = t.last.marks;
        const colours = new Set(Object.values(groups));
        const clash = t.last.data.edges.filter(
          (e) => groups[e.from] === groups[e.to],
        );
        return [
          ...graphIs(
            t,
            ['A', 'B', 'C', 'D', 'E'],
            [
              ['A', 'B'],
              ['B', 'C'],
              ['C', 'A'],
              ['C', 'D'],
              ['D', 'E'],
            ],
            false,
          ),
          ...expect(
            nodeIds(t.last).every((n) => groups[n] !== undefined),
            'not every node is coloured',
          ),
          ...expect(
            clash.length === 0,
            `neighbours share a colour: ${clash.map((e) => e.id).join(', ')}`,
          ),
          ...expect(colours.size === 3, `uses ${colours.size} colours, not 3`),
        ];
      }),
  },
  {
    id: 'lcs',
    kinds: ['table'],
    prompt:
      'Longest common subsequence of "ABCB" and "BDCAB" with a dynamic programming table, including the empty-prefix row and column.',
    minSteps: 6,
    check: (trace) =>
      anyTrack(trace, 'table', (t) => {
        const want = lcsTable('ABCB', 'BDCAB');
        const rows = t.last.data;
        const wrong = want.flatMap((row, r) =>
          row
            .map((v, c) => [r, c, v] as const)
            .filter(([, c, v]) => num(rows[r]?.[c] ?? null) !== v)
            .map(
              ([r, c, v]) =>
                `(${r}, ${c}) is ${String(rows[r]?.[c] ?? null)}, not ${v}`,
            ),
        );
        return [
          ...expect(
            rows.length === 5 && rows[0]?.length === 6,
            `is ${rows.length}×${rows[0]?.length ?? 0}, not 5×6`,
          ),
          ...expect(
            wrong.length === 0,
            `${wrong.length} wrong cells: ${wrong.slice(0, 3).join('; ')}`,
          ),
        ];
      }),
  },
  {
    id: 'coin-change',
    kinds: ['table'],
    prompt:
      'Minimum number of coins to make 6 from coins 1, 3 and 4, with a one-row dynamic programming table over amounts 0 to 6.',
    minSteps: 6,
    check: (trace) => {
      const want = [0, 1, 2, 1, 1, 2, 2];
      const rows = [
        ...tracks(trace, 'table').flatMap((t) => t.last.data),
        ...tracks(trace, 'array').map((t) => values(t.last)),
      ];
      return expect(
        rows.some((row) => same(nums(row), want)),
        `no table row or array ends as ${JSON.stringify(want)}`,
      );
    },
  },
  {
    id: 'hash-chaining',
    kinds: ['hashTable'],
    prompt:
      'Insert the keys 15, 11, 27, 8 and 12 into a hash table with 7 buckets and separate chaining, using h(k) = k mod 7.',
    minSteps: 5,
    check: (trace) =>
      anyTrack(trace, 'hashTable', (t) => {
        const got = t.last.data.map((chain) => nums(chain.map((e) => e.value)));
        return expect(
          same(got, [[], [15, 8], [], [], [11], [12], [27]]),
          `ends as ${JSON.stringify(got)}`,
        );
      }),
  },
  {
    id: 'linear-probing',
    kinds: ['array'],
    prompt:
      'Insert the keys 18, 41, 22, 44, 59, 32, 31 and 73 into a hash table of 13 slots with linear probing and h(k) = k mod 13. Use an array with null for empty slots.',
    minSteps: 8,
    check: (trace) =>
      anyTrack(trace, 'array', (t) => {
        const got = values(t.last).map((v) =>
          v === null || v === '' ? null : num(v),
        );
        return expect(
          same(got, [
            null,
            null,
            41,
            null,
            null,
            18,
            44,
            59,
            32,
            22,
            31,
            73,
            null,
          ]),
          `ends as ${JSON.stringify(got)}`,
        );
      }),
  },
];

export const findTask = (id: string) => tasks.find((t) => t.id === id);
