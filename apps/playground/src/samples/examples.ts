/**
 * Ready-made documents from @algoviz/recipes, for the example picker.
 */
import * as recipes from '@algoviz/recipes';
import type { GraphInput } from '@algoviz/recipes';
import type { VisualizationInput } from '@algoviz/spec';

const cities: GraphInput = {
  nodes: ['A', 'B', 'C', 'D', 'E', 'F'],
  edges: [
    ['A', 'B', 7],
    ['A', 'C', 9],
    ['A', 'F', 14],
    ['B', 'C', 10],
    ['B', 'D', 15],
    ['C', 'D', 11],
    ['C', 'F', 2],
    ['D', 'E', 6],
    ['E', 'F', 9],
  ],
};

const clothes: GraphInput = {
  directed: true,
  nodes: [
    'undershorts',
    'socks',
    'pants',
    'shoes',
    'shirt',
    'belt',
    'tie',
    'jacket',
  ],
  edges: [
    ['undershorts', 'pants'],
    ['undershorts', 'shoes'],
    ['pants', 'belt'],
    ['pants', 'shoes'],
    ['belt', 'jacket'],
    ['shirt', 'belt'],
    ['shirt', 'tie'],
    ['tie', 'jacket'],
    ['socks', 'shoes'],
  ],
};

export interface Example {
  readonly group: string;
  readonly label: string;
  readonly build: () => VisualizationInput;
}

const values = [5, 3, 8, 1, 9, 2, 7];

export const examples: readonly Example[] = [
  {
    group: 'Sorting',
    label: 'Bubble sort',
    build: () => recipes.bubbleSort(values),
  },
  {
    group: 'Sorting',
    label: 'Insertion sort',
    build: () => recipes.insertionSort(values),
  },
  {
    group: 'Sorting',
    label: 'Selection sort',
    build: () => recipes.selectionSort(values),
  },
  {
    group: 'Sorting',
    label: 'Merge sort',
    build: () => recipes.mergeSort(values),
  },
  {
    group: 'Sorting',
    label: 'Quicksort',
    build: () => recipes.quickSort(values),
  },
  {
    group: 'Sorting',
    label: 'Heapsort',
    build: () => recipes.heapSort(values),
  },
  {
    group: 'Sorting',
    label: 'Counting sort',
    build: () => recipes.countingSort([3, 1, 4, 1, 5, 2, 0]),
  },
  {
    group: 'Searching',
    label: 'Binary search',
    build: () => recipes.binarySearch([1, 3, 4, 7, 9, 11, 15], 9),
  },
  {
    group: 'Lists and stacks',
    label: 'Reverse a linked list',
    build: () => recipes.reverseLinkedList([1, 2, 3, 4]),
  },
  {
    group: 'Lists and stacks',
    label: 'Balanced brackets',
    build: () => recipes.balancedBrackets('{[()()]}'),
  },
  {
    group: 'Trees',
    label: 'Binary search tree',
    build: () => recipes.bstInsert([8, 3, 10, 1, 6, 14, 4, 7, 13], 7),
  },
  {
    group: 'Trees',
    label: 'AVL tree',
    build: () => recipes.avlInsert([10, 20, 30, 40, 50, 25]),
  },
  {
    group: 'Trees',
    label: 'Inorder traversal',
    build: () => recipes.treeTraversal([1, 2, 3, 4, 5, null, 6], 'inorder'),
  },
  {
    group: 'Trees',
    label: 'Binary heap',
    build: () => recipes.binaryHeap([5, 3, 8, 1, 9, 2]),
  },
  {
    group: 'Trees',
    label: 'Trie',
    build: () => recipes.trieInsert(['tea', 'ten', 'to', 'inn', 'in']),
  },
  {
    group: 'Trees',
    label: 'Union–find',
    build: () =>
      recipes.unionFind(8, [
        [0, 1],
        [2, 3],
        [1, 3],
        [4, 5],
        [0, 2],
        [6, 7],
        [5, 7],
      ]),
  },
  {
    group: 'Graphs',
    label: 'Breadth-first search',
    build: () => recipes.breadthFirstSearch(cities, 'A'),
  },
  {
    group: 'Graphs',
    label: 'Depth-first search',
    build: () => recipes.depthFirstSearch(clothes, 'undershorts'),
  },
  {
    group: 'Graphs',
    label: 'Dijkstra',
    build: () => recipes.dijkstra(cities, 'A'),
  },
  {
    group: 'Graphs',
    label: 'Bellman–Ford',
    build: () =>
      recipes.bellmanFord(
        {
          nodes: ['s', 'a', 'b', 'c'],
          edges: [
            ['s', 'a', 4],
            ['s', 'b', 5],
            ['b', 'a', -3],
            ['a', 'c', 2],
          ],
        },
        's',
      ),
  },
  { group: 'Graphs', label: 'Prim', build: () => recipes.prim(cities, 'A') },
  { group: 'Graphs', label: 'Kruskal', build: () => recipes.kruskal(cities) },
  {
    group: 'Graphs',
    label: 'Topological sort',
    build: () => recipes.topologicalSort(clothes),
  },
  {
    group: 'Graphs',
    label: 'Floyd–Warshall',
    build: () =>
      recipes.floydWarshall({
        directed: true,
        nodes: ['1', '2', '3', '4'],
        edges: [
          ['1', '3', -2],
          ['3', '4', 2],
          ['4', '2', -1],
          ['2', '1', 4],
          ['2', '3', 3],
        ],
      }),
  },
  {
    group: 'Dynamic programming',
    label: 'Longest common subsequence',
    build: () => recipes.longestCommonSubsequence('ABCBDAB', 'BDCABA'),
  },
  {
    group: 'Dynamic programming',
    label: 'Edit distance',
    build: () => recipes.editDistance('kitten', 'sitting'),
  },
  {
    group: 'Dynamic programming',
    label: '0/1 knapsack',
    build: () =>
      recipes.knapsack(
        [
          { weight: 1, value: 1 },
          { weight: 3, value: 4 },
          { weight: 4, value: 5 },
          { weight: 5, value: 7 },
        ],
        7,
      ),
  },
  {
    group: 'Hashing',
    label: 'Separate chaining',
    build: () => recipes.hashChaining([15, 11, 27, 8, 12, 4, 22], 7, 22),
  },
  {
    group: 'Hashing',
    label: 'Linear probing',
    build: () => recipes.linearProbing([15, 11, 27, 8, 12], 7),
  },
];

export const exampleGroups = [...new Set(examples.map((e) => e.group))];
