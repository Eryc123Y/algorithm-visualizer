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
];
