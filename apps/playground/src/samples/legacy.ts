/**
 * The legacy path (ADR 0022): examples of recipes not yet in the registry,
 * which keep their old functions until roadmap 0.5 migrates them. Then
 * this file goes; new algorithms are registry modules, and the menu picks
 * them up from their examples.
 */
import * as recipes from '@algoviz/recipes';
import type { GraphInput } from '@algoviz/recipes';

import type { Example } from './examples';

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

const values = [5, 3, 8, 1, 9, 2, 7];

export const legacyExamples: readonly Example[] = [
  {
    topic: 'sorting',
    label: 'Bubble sort',
    build: () => recipes.bubbleSort(values),
  },
  {
    topic: 'sorting',
    label: 'Insertion sort',
    build: () => recipes.insertionSort(values),
  },
  {
    topic: 'sorting',
    label: 'Selection sort',
    build: () => recipes.selectionSort(values),
  },
  {
    topic: 'sorting',
    label: 'Merge sort',
    build: () => recipes.mergeSort(values),
  },
  {
    topic: 'sorting',
    label: 'Quicksort',
    build: () => recipes.quickSort(values),
  },
  {
    topic: 'sorting',
    label: 'Heapsort',
    build: () => recipes.heapSort(values),
  },
  {
    topic: 'sorting',
    label: 'Counting sort',
    build: () => recipes.countingSort([3, 1, 4, 1, 5, 2, 0]),
  },
  {
    topic: 'searching',
    label: 'Binary search',
    build: () => recipes.binarySearch([1, 3, 4, 7, 9, 11, 15], 9),
  },
  {
    topic: 'lists',
    label: 'Reverse a linked list',
    build: () => recipes.reverseLinkedList([1, 2, 3, 4]),
  },
  {
    topic: 'lists',
    label: 'Balanced brackets',
    build: () => recipes.balancedBrackets('{[()()]}'),
  },
  {
    topic: 'trees',
    label: 'BST: insert keys, then search',
    build: () => recipes.bstInsert([8, 3, 10, 1, 6, 14, 4, 7, 13], 7),
  },
  {
    topic: 'trees',
    label: 'AVL tree',
    build: () => recipes.avlInsert([10, 20, 30, 40, 50, 25]),
  },
  {
    topic: 'trees',
    label: 'Inorder traversal',
    build: () => recipes.treeTraversal([1, 2, 3, 4, 5, null, 6], 'inorder'),
  },
  {
    topic: 'heaps',
    label: 'Binary heap',
    build: () => recipes.binaryHeap([5, 3, 8, 1, 9, 2]),
  },
  {
    topic: 'trees',
    label: 'Trie',
    build: () => recipes.trieInsert(['tea', 'ten', 'to', 'inn', 'in']),
  },
  {
    topic: 'trees',
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
    topic: 'graphs',
    label: 'Breadth-first search',
    build: () => recipes.breadthFirstSearch(cities, 'A'),
  },
  {
    topic: 'graphs',
    label: 'Depth-first search',
    build: () => recipes.depthFirstSearch(clothes, 'undershorts'),
  },
  {
    topic: 'graphs',
    label: 'Dijkstra',
    build: () => recipes.dijkstra(cities, 'A'),
  },
  {
    topic: 'graphs',
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
  { topic: 'graphs', label: 'Prim', build: () => recipes.prim(cities, 'A') },
  { topic: 'graphs', label: 'Kruskal', build: () => recipes.kruskal(cities) },
  {
    topic: 'graphs',
    label: 'Topological sort',
    build: () => recipes.topologicalSort(clothes),
  },
  {
    topic: 'graphs',
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
    topic: 'dynamic-programming',
    label: 'Longest common subsequence',
    build: () => recipes.longestCommonSubsequence('ABCBDAB', 'BDCABA'),
  },
  {
    topic: 'dynamic-programming',
    label: 'Edit distance',
    build: () => recipes.editDistance('kitten', 'sitting'),
  },
  {
    topic: 'dynamic-programming',
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
    topic: 'hashing',
    label: 'Separate chaining',
    build: () => recipes.hashChaining([15, 11, 27, 8, 12, 4, 22], 7, 22),
  },
  {
    topic: 'hashing',
    label: 'Linear probing',
    build: () => recipes.linearProbing([15, 11, 27, 8, 12], 7),
  },
];
