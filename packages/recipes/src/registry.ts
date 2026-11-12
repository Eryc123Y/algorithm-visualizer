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
import { huffman } from './algorithms/greedy/huffman.ts';
import { bellmanFord } from './algorithms/graphs/bellman-ford.ts';
import { bfs } from './algorithms/graphs/bfs.ts';
import { dfs } from './algorithms/graphs/dfs.ts';
import { dagShortestPaths } from './algorithms/graphs/dag-shortest-paths.ts';
import { dijkstra } from './algorithms/graphs/dijkstra.ts';
import { edmondsKarp } from './algorithms/graphs/edmonds-karp.ts';
import { bipartiteMatching } from './algorithms/graphs/bipartite-matching.ts';
import { hopcroftKarp } from './algorithms/graphs/hopcroft-karp.ts';
import { galeShapley } from './algorithms/graphs/gale-shapley.ts';
import { hungarian } from './algorithms/graphs/hungarian.ts';
import { floydWarshall } from './algorithms/graphs/floyd-warshall.ts';
import { transitiveClosure } from './algorithms/graphs/transitive-closure.ts';
import { johnson } from './algorithms/graphs/johnson.ts';
import { kruskal } from './algorithms/graphs/kruskal.ts';
import { prim } from './algorithms/graphs/prim.ts';
import { stronglyConnectedComponents } from './algorithms/graphs/scc.ts';
import { topologicalSort } from './algorithms/graphs/topological-sort.ts';
import { balancedBrackets } from './algorithms/lists/balanced-brackets.ts';
import { reverseLinkedList } from './algorithms/lists/reverse-linked-list.ts';
import { moveToFront } from './algorithms/lists/move-to-front.ts';
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
import { finiteAutomatonMatcher } from './algorithms/strings/finite-automaton.ts';
import { kmp } from './algorithms/strings/kmp.ts';
import { strassen } from './algorithms/foundations/strassen.ts';
import { lup } from './algorithms/math/lup.ts';
import { fft } from './algorithms/math/fft.ts';
import { euclid, extendedEuclid } from './algorithms/math/euclid.ts';
import { modularExponentiation } from './algorithms/math/modular-exponentiation.ts';
import { naiveStringMatcher } from './algorithms/strings/naive.ts';
import { rabinKarp } from './algorithms/strings/rabin-karp.ts';
import { closestPair } from './algorithms/geometry/closest-pair.ts';
import { grahamScan } from './algorithms/geometry/graham-scan.ts';
import { jarvisMarch } from './algorithms/geometry/jarvis-march.ts';
import { anySegmentsIntersect } from './algorithms/geometry/segments-intersect.ts';
import { runModule, type AlgorithmRun } from './run-module.ts';
import { avl } from './structures/avl/index.ts';
import { bTree } from './structures/b-tree/index.ts';
import { bst } from './structures/bst/index.ts';
import { disjointSet } from './structures/disjoint-set/index.ts';
import { hashChaining } from './structures/hashing/chaining.ts';
import { linearProbing } from './structures/hashing/linear-probing.ts';
import { fibonacciHeap } from './structures/fibonacci-heap/index.ts';
import { maxHeap, minHeap } from './structures/heap/index.ts';
import { intervalTree } from './structures/red-black/interval-tree.ts';
import { orderStatisticTree } from './structures/red-black/order-statistic-tree.ts';
import { redBlackTree } from './structures/red-black/red-black-tree.ts';
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
  moveToFront,
  balancedBrackets,
  ...bst.modules,
  ...avl.modules,
  ...redBlackTree.modules,
  ...orderStatisticTree.modules,
  ...intervalTree.modules,
  ...bTree.modules,
  inorderTreeWalk,
  preorderTreeWalk,
  postorderTreeWalk,
  ...trie.modules,
  ...disjointSet.modules,
  ...minHeap.modules,
  ...maxHeap.modules,
  ...fibonacciHeap.modules,
  ...hashChaining.modules,
  ...linearProbing.modules,
  bfs,
  dfs,
  topologicalSort,
  stronglyConnectedComponents,
  dijkstra,
  bellmanFord,
  dagShortestPaths,
  prim,
  kruskal,
  floydWarshall,
  transitiveClosure,
  johnson,
  edmondsKarp,
  bipartiteMatching,
  hopcroftKarp,
  galeShapley,
  hungarian,
  lcs,
  editDistance,
  knapsack,
  huffman,
  naiveStringMatcher,
  rabinKarp,
  finiteAutomatonMatcher,
  kmp,
  anySegmentsIntersect,
  grahamScan,
  jarvisMarch,
  closestPair,
  lup,
  fft,
  euclid,
  extendedEuclid,
  modularExponentiation,
  strassen,
];

/** The module with `id`, if there is one. */
export const findAlgorithm = (id: string): Algorithm | undefined =>
  algorithms.find((a) => a.id === id);

/**
 * Runs the module with `id` on `input`, or on its first example (see
 * `runModule`); an unknown id is an `UNKNOWN_ALGORITHM` error at `$.id`.
 */
export function runAlgorithm(
  id: string,
  input?: unknown,
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
