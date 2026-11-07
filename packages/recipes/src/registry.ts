/**
 * The registry (ADR 0019): every module, listed explicitly, and running one
 * by id. MCP, the command line, the playground and the packages for Typst
 * and LaTeX all read it, so adding an algorithm means adding its module
 * here.
 */
import { err, type Diagnostic, type Result } from '@algoviz/spec';

import type { Algorithm } from './algorithm.ts';
import { editDistance } from './algorithms/dynamic-programming/edit-distance.ts';
import { knapsack } from './algorithms/dynamic-programming/knapsack.ts';
import { lcs } from './algorithms/dynamic-programming/lcs.ts';
import { bellmanFord } from './algorithms/graphs/bellman-ford.ts';
import { bfs } from './algorithms/graphs/bfs.ts';
import { dfs } from './algorithms/graphs/dfs.ts';
import { dijkstra } from './algorithms/graphs/dijkstra.ts';
import { floydWarshall } from './algorithms/graphs/floyd-warshall.ts';
import { kruskal } from './algorithms/graphs/kruskal.ts';
import { prim } from './algorithms/graphs/prim.ts';
import { topologicalSort } from './algorithms/graphs/topological-sort.ts';
import { balancedBrackets } from './algorithms/lists/balanced-brackets.ts';
import { reverseLinkedList } from './algorithms/lists/reverse-linked-list.ts';
import { binarySearch } from './algorithms/searching/binary-search.ts';
import { bubbleSort } from './algorithms/sorting/bubble-sort.ts';
import { countingSort } from './algorithms/sorting/counting-sort.ts';
import { heapsort } from './algorithms/sorting/heapsort.ts';
import { insertionSort } from './algorithms/sorting/insertion-sort.ts';
import { mergeSort } from './algorithms/sorting/merge-sort.ts';
import { quicksort } from './algorithms/sorting/quicksort.ts';
import { selectionSort } from './algorithms/sorting/selection-sort.ts';
import {
  inorderTreeWalk,
  postorderTreeWalk,
  preorderTreeWalk,
} from './algorithms/trees/tree-walks.ts';
import { runModule, type AlgorithmRun } from './run-module.ts';
import { avl } from './structures/avl/index.ts';
import { bst } from './structures/bst/index.ts';
import { disjointSet } from './structures/disjoint-set/index.ts';
import { hashChaining } from './structures/hashing/chaining.ts';
import { linearProbing } from './structures/hashing/linear-probing.ts';
import { maxHeap, minHeap } from './structures/heap/index.ts';
import { trie } from './structures/trie/index.ts';

/** Every module, grouped by topic in menu order. */
export const algorithms: readonly Algorithm[] = [
  insertionSort,
  mergeSort,
  heapsort,
  quicksort,
  countingSort,
  bubbleSort,
  selectionSort,
  binarySearch,
  reverseLinkedList,
  balancedBrackets,
  ...bst.modules,
  ...avl.modules,
  inorderTreeWalk,
  preorderTreeWalk,
  postorderTreeWalk,
  ...trie.modules,
  ...disjointSet.modules,
  ...minHeap.modules,
  ...maxHeap.modules,
  ...hashChaining.modules,
  ...linearProbing.modules,
  bfs,
  dfs,
  topologicalSort,
  dijkstra,
  bellmanFord,
  prim,
  kruskal,
  floydWarshall,
  lcs,
  editDistance,
  knapsack,
];

/** The module with `id`, if there is one. */
export const findAlgorithm = (id: string): Algorithm | undefined =>
  algorithms.find((a) => a.id === id);

/**
 * Runs the module with `id` on `input` (see `runModule`); an unknown id is
 * an `UNKNOWN_ALGORITHM` error at `$.id`.
 */
export function runAlgorithm(
  id: string,
  input: unknown,
): Result<AlgorithmRun, readonly Diagnostic[]> {
  const algorithm = findAlgorithm(id);
  if (algorithm === undefined)
    return err([
      {
        code: 'UNKNOWN_ALGORITHM',
        path: '$.id',
        message: `No algorithm with id "${id}"`,
        hint: `Ids: ${algorithms.map((a) => a.id).join(', ')}.`,
      },
    ]);
  return runModule(algorithm, input);
}
