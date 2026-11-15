/**
 * The modules whose text is not in Chinese yet, by id, or by structure for
 * a structure's operations (ADR 0045). Each translation removes its
 * modules; the list is empty when roadmap 5.8 is done.
 */
export const PENDING_ZH: ReadonlySet<string> = new Set([
  'lcs',
  'edit-distance',
  'knapsack',
  'rod-cutting',
  'matrix-chain',
  'optimal-bst',
  'activity-selection',
  'huffman',
  'offline-caching',
  'greedy-set-cover',
  'naive-string-matcher',
  'rabin-karp',
  'finite-automaton-matcher',
  'kmp',
  'suffix-array',
  'any-segments-intersect',
  'graham-scan',
  'jarvis-march',
  'closest-pair',
  'lup-decomposition',
  'fft',
  'euclid',
  'extended-euclid',
  'modular-exponentiation',
  'strassen',
  'recursion-tree',
  'random-permutation',
  'dynamic-table',
  'binary-counter',
]);
