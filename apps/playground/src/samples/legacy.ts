/**
 * The legacy path (ADR 0022): examples of recipes not yet in the registry,
 * which keep their old functions until roadmap 0.5 migrates them. Then
 * this file goes; new algorithms are registry modules, and the menu picks
 * them up from their examples.
 */
import * as recipes from '@algoviz/recipes';

import type { Example } from './examples';

export const legacyExamples: readonly Example[] = [
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
];
