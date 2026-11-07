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
  longestCommonSubsequence: 'Longest common subsequence',
  editDistance: 'Edit distance',
  knapsack: '0/1 knapsack',
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

const Text = (description: string) =>
  z.string().min(1).max(16).describe(description);

/** The recipes not in the registry yet, in the order a course might meet them. */
export const legacyRecipes: readonly CatalogEntry[] = [
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
];
