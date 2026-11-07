/**
 * The legacy path (ADR 0022): recipes not yet in the registry of
 * @algoviz/recipes, with argument schemas written here. They keep their
 * camelCase ids until roadmap 0.5 migrates them, and then this file goes.
 * Nothing new is added here: new algorithms are registry modules.
 */
import { loadTrace } from '@algoviz/core';
import * as recipes from '@algoviz/recipes';
import type { Topic } from '@algoviz/recipes';
import { err, fromZodIssues, ok, type VisualizationInput } from '@algoviz/spec';
import { z } from 'zod';

import type { CatalogEntry } from './recipes.ts';

/** Short titles, as the playground's menu shows them. */
const TITLES: Readonly<Record<string, string>> = {
  bubbleSort: 'Bubble sort',
  insertionSort: 'Insertion sort',
  selectionSort: 'Selection sort',
  mergeSort: 'Merge sort',
  quickSort: 'Quicksort',
  heapSort: 'Heapsort',
  countingSort: 'Counting sort',
  binarySearch: 'Binary search',
  reverseLinkedList: 'Reverse a linked list',
  balancedBrackets: 'Balanced brackets',
  bstInsert: 'BST: insert keys, then search',
  avlInsert: 'AVL tree',
  treeTraversal: 'Tree traversal',
  binaryHeap: 'Binary heap: push all, then pop all',
  trieInsert: 'Trie',
  unionFind: 'Union–find',
  breadthFirstSearch: 'Breadth-first search',
  depthFirstSearch: 'Depth-first search',
  dijkstra: 'Dijkstra',
  bellmanFord: 'Bellman–Ford',
  prim: 'Prim',
  kruskal: 'Kruskal',
  topologicalSort: 'Topological sort',
  floydWarshall: 'Floyd–Warshall',
  longestCommonSubsequence: 'Longest common subsequence',
  editDistance: 'Edit distance',
  knapsack: '0/1 knapsack',
  hashChaining: 'Separate chaining',
  linearProbing: 'Linear probing',
};

function recipe<S extends z.ZodObject>(
  topic: Topic,
  id: string,
  description: string,
  input: S,
  build: (input: z.output<S>) => VisualizationInput,
): CatalogEntry {
  return {
    id,
    title: TITLES[id] ?? description,
    topic,
    summary: `${description}.`,
    input,
    run(given) {
      const parsed = input.safeParse(given);
      if (!parsed.success)
        return err(
          fromZodIssues(parsed.error.issues, ['input'], 'INVALID_SHAPE'),
        );
      let doc: VisualizationInput;
      try {
        doc = build(parsed.data);
      } catch (e) {
        // Recipes reject inputs they cannot show, e.g. negative weights.
        if (!(e instanceof RangeError)) throw e;
        return err([
          { code: 'INVALID_ARGUMENT', path: '$.input', message: e.message },
        ]);
      }
      // Large or unusual inputs can exceed the protocol's limits.
      const loaded = loadTrace(doc);
      return loaded.ok ? ok(doc) : loaded;
    },
  };
}

const Values = z
  .array(z.number())
  .min(1)
  .max(32)
  .describe('The numbers to work on, e.g. [5, 3, 8, 1].');

const Graph = z
  .strictObject({
    nodes: z
      .array(z.string())
      .min(1)
      .max(40)
      .describe('Node names, e.g. ["A", "B", "C"].'),
    edges: z
      .array(
        z.union([
          z.tuple([z.string(), z.string()]),
          z.tuple([z.string(), z.string(), z.number()]),
        ]),
      )
      .max(200)
      .describe(
        'Edges as [from, to] or [from, to, weight]; weight 1 by default.',
      ),
    directed: z.boolean().optional().describe('Default false.'),
  })
  .describe('A graph.');

/** Drops an absent `directed`, which `GraphInput` leaves out rather than allowing undefined. */
const graphInput = ({
  directed,
  ...rest
}: z.output<typeof Graph>): recipes.GraphInput =>
  directed === undefined ? rest : { ...rest, directed };

const Start = z.string().describe('Name of the start node.');

const Text = (description: string) =>
  z.string().min(1).max(16).describe(description);

/** The recipes not in the registry yet, in the order a course might meet them. */
export const legacyRecipes: readonly CatalogEntry[] = [
  ...(
    [
      ['bubbleSort', 'Bubble sort'],
      ['insertionSort', 'Insertion sort'],
      ['selectionSort', 'Selection sort'],
      ['mergeSort', 'Merge sort, with the merge buffer'],
      ['quickSort', 'Quicksort with Lomuto partitioning'],
      ['heapSort', 'Heapsort, with the array drawn as a heap'],
    ] as const
  ).map(([name, description]) =>
    recipe(
      'sorting',
      name,
      description,
      z.strictObject({ values: Values }),
      ({ values }) => recipes[name](values),
    ),
  ),
  recipe(
    'sorting',
    'countingSort',
    'Counting sort, with the count array',
    z.strictObject({
      values: z
        .array(z.int().min(0).max(99))
        .min(1)
        .max(32)
        .describe('Integers from 0 to 99.'),
    }),
    ({ values }) => recipes.countingSort(values),
  ),
  recipe(
    'searching',
    'binarySearch',
    'Binary search in a sorted array',
    z.strictObject({
      values: Values.describe('Sorted numbers.'),
      target: z.number().describe('The value to find.'),
    }),
    ({ values, target }) => recipes.binarySearch(values, target),
  ),
  recipe(
    'lists',
    'reverseLinkedList',
    'Reversing a singly linked list in place, one pointer at a time',
    z.strictObject({ values: Values.max(12) }),
    ({ values }) => recipes.reverseLinkedList(values),
  ),
  recipe(
    'lists',
    'balancedBrackets',
    'Checking balanced brackets with a stack',
    z.strictObject({
      text: z
        .string()
        .min(1)
        .max(32)
        .describe('Text with brackets, e.g. "{[()]}".'),
    }),
    ({ text }) => recipes.balancedBrackets(text),
  ),
  recipe(
    'trees',
    'bstInsert',
    'Inserting keys into a binary search tree, then optionally searching',
    z.strictObject({
      keys: Values.describe('Keys in insertion order.'),
      search: z.number().optional().describe('A key to search for afterwards.'),
    }),
    ({ keys, search }) => recipes.bstInsert(keys, search),
  ),
  recipe(
    'trees',
    'avlInsert',
    'Inserting keys into an AVL tree, with heights and rotations',
    z.strictObject({ keys: Values.describe('Keys in insertion order.') }),
    ({ keys }) => recipes.avlInsert(keys),
  ),
  recipe(
    'trees',
    'treeTraversal',
    'Pre-, in- or post-order traversal of a binary tree',
    z.strictObject({
      levelOrder: z
        .array(z.number().nullable())
        .min(1)
        .max(31)
        .describe(
          'The tree in level order, null for gaps, e.g. [4, 2, 6, 1, 3, null, 7].',
        ),
      order: z.enum(['preorder', 'inorder', 'postorder']),
    }),
    ({ levelOrder, order }) => recipes.treeTraversal(levelOrder, order),
  ),
  recipe(
    'heaps',
    'binaryHeap',
    'Pushing values onto a binary min-heap (sift up), then popping them all (sift down), as a tree and an array',
    z.strictObject({ values: Values }),
    ({ values }) => recipes.binaryHeap(values),
  ),
  recipe(
    'trees',
    'trieInsert',
    'Inserting words into a trie',
    z.strictObject({
      words: z.array(Text('A word.')).min(1).max(8),
    }),
    ({ words }) => recipes.trieInsert(words),
  ),
  recipe(
    'trees',
    'unionFind',
    'Union–find with union by rank and path compression',
    z.strictObject({
      size: z.int().min(1).max(16).describe('Elements 0 to size − 1.'),
      unions: z
        .array(z.tuple([z.int().min(0), z.int().min(0)]))
        .max(32)
        .describe('Pairs to unite, e.g. [[0, 1], [2, 3]].'),
    }),
    ({ size, unions }) => recipes.unionFind(size, unions),
  ),
  recipe(
    'graphs',
    'breadthFirstSearch',
    'Breadth-first search with its queue',
    z.strictObject({ graph: Graph, start: Start }),
    ({ graph, start }) => recipes.breadthFirstSearch(graphInput(graph), start),
  ),
  recipe(
    'graphs',
    'depthFirstSearch',
    'Depth-first search with its stack',
    z.strictObject({ graph: Graph, start: Start }),
    ({ graph, start }) => recipes.depthFirstSearch(graphInput(graph), start),
  ),
  recipe(
    'graphs',
    'dijkstra',
    'Dijkstra’s shortest paths (non-negative weights)',
    z.strictObject({ graph: Graph, source: Start }),
    ({ graph, source }) => recipes.dijkstra(graphInput(graph), source),
  ),
  recipe(
    'graphs',
    'bellmanFord',
    'Bellman–Ford shortest paths, which allows negative weights',
    z.strictObject({ graph: Graph, source: Start }),
    ({ graph, source }) => recipes.bellmanFord(graphInput(graph), source),
  ),
  recipe(
    'graphs',
    'prim',
    'Prim’s minimum spanning tree',
    z.strictObject({ graph: Graph, start: Start }),
    ({ graph, start }) => recipes.prim(graphInput(graph), start),
  ),
  recipe(
    'graphs',
    'kruskal',
    'Kruskal’s minimum spanning tree',
    z.strictObject({ graph: Graph }),
    ({ graph }) => recipes.kruskal(graphInput(graph)),
  ),
  recipe(
    'graphs',
    'topologicalSort',
    'Topological sort with Kahn’s algorithm (directed graphs)',
    z.strictObject({ graph: Graph }),
    ({ graph }) => recipes.topologicalSort(graphInput(graph)),
  ),
  recipe(
    'graphs',
    'floydWarshall',
    'Floyd–Warshall all-pairs shortest paths, as a distance table',
    z.strictObject({ graph: Graph }),
    ({ graph }) => recipes.floydWarshall(graphInput(graph)),
  ),
  recipe(
    'dynamic-programming',
    'longestCommonSubsequence',
    'Longest common subsequence table, with the traceback',
    z.strictObject({
      first: Text('First string.'),
      second: Text('Second string.'),
    }),
    ({ first, second }) => recipes.longestCommonSubsequence(first, second),
  ),
  recipe(
    'dynamic-programming',
    'editDistance',
    'Edit (Levenshtein) distance table, with the traceback',
    z.strictObject({
      first: Text('First string.'),
      second: Text('Second string.'),
    }),
    ({ first, second }) => recipes.editDistance(first, second),
  ),
  recipe(
    'dynamic-programming',
    'knapsack',
    '0/1 knapsack table',
    z.strictObject({
      items: z
        .array(z.strictObject({ weight: z.int().min(1), value: z.number() }))
        .min(1)
        .max(8),
      capacity: z.int().min(0).max(40),
    }),
    ({ items, capacity }) => recipes.knapsack(items, capacity),
  ),
  recipe(
    'hashing',
    'hashChaining',
    'Hash table with separate chaining (h(k) = k mod size)',
    z.strictObject({
      keys: z.array(z.int()).min(1).max(24),
      size: z.int().min(1).max(16),
      search: z.int().optional().describe('A key to look up afterwards.'),
    }),
    ({ keys, size, search }) => recipes.hashChaining(keys, size, search),
  ),
  recipe(
    'hashing',
    'linearProbing',
    'Hash table with linear probing (h(k) = k mod size)',
    z.strictObject({
      keys: z.array(z.int()).min(1).max(16),
      size: z.int().min(1).max(16),
    }),
    ({ keys, size }) => recipes.linearProbing(keys, size),
  ),
];
