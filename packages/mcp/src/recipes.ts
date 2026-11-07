/**
 * The ready-made visualizations a model can run: every module of the
 * registry of @algoviz/recipes (ADR 0019), and the recipes not migrated
 * yet (ADR 0022), in one list with one shape.
 */
import {
  algorithms,
  runModule,
  TOPICS,
  type Algorithm,
  type Topic,
} from '@algoviz/recipes';
import {
  err,
  ok,
  type Diagnostic,
  type Result,
  type VisualizationInput,
} from '@algoviz/spec';
import { z } from 'zod';

import { legacyRecipes } from './legacy-recipes.ts';

/** One entry of the catalogue, as MCP and the CLI show it. */
export interface CatalogEntry {
  /** The registry id, e.g. `bst.delete`; camelCase for legacy recipes. */
  readonly id: string;
  readonly title: string;
  readonly topic: Topic;
  readonly summary: string;
  readonly input: z.ZodType;
  /** Builds the document; it is checked before it is returned. */
  run(input: unknown): Result<VisualizationInput, readonly Diagnostic[]>;
}

function fromModule(algorithm: Algorithm): CatalogEntry {
  const { id, title, topic, summary, input } = algorithm;
  return {
    id,
    title,
    topic,
    summary,
    input,
    run(given) {
      const run = runModule(algorithm, given);
      return run.ok ? ok(run.value.document) : run;
    },
  };
}

const topicOrder = (e: CatalogEntry) => TOPICS.indexOf(e.topic);

/** Every entry, grouped by topic in menu order. */
export const recipeCatalog: readonly CatalogEntry[] = [
  ...algorithms.map(fromModule),
  ...legacyRecipes,
].sort((a, b) => topicOrder(a) - topicOrder(b));

export const findRecipe = (id: string): CatalogEntry | undefined =>
  recipeCatalog.find((r) => r.id === id);

/** What a model reads: id, title, topic, summary and the input's JSON Schema. */
export function listRecipes() {
  return recipeCatalog.map((r) => ({
    id: r.id,
    title: r.title,
    topic: r.topic,
    summary: r.summary,
    input: z.toJSONSchema(r.input, { target: 'draft-2020-12', io: 'input' }),
  }));
}

/**
 * Runs the entry `id` on `input`. Errors are `UNKNOWN_RECIPE` at `$.id`,
 * `INVALID_SHAPE` under `$.input`, `INVALID_ARGUMENT` at `$.input`, or the
 * engine's.
 */
export function runRecipe(
  id: string,
  input: unknown,
): Result<VisualizationInput, readonly Diagnostic[]> {
  const entry = findRecipe(id);
  if (entry === undefined)
    return err([
      {
        code: 'UNKNOWN_RECIPE',
        path: '$.id',
        message: `No recipe with id "${id}"`,
        hint: `Ids: ${recipeCatalog.map((r) => r.id).join(', ')}.`,
      },
    ]);
  return entry.run(input);
}
