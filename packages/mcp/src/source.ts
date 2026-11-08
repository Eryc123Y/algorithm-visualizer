/**
 * What the drawing tools draw (ADR 0032): a document, or a recipe run on
 * its input, so that a model shows a recipe by name without copying its
 * document.
 */
import { err, ok, type Diagnostic, type Result } from '@algoviz/spec';
import { z } from 'zod';

import { runRecipe } from './recipes.ts';

export const Document = z
  .union([z.record(z.string(), z.unknown()), z.string()])
  .describe(
    'The visualization document: a JSON object with version, structures and steps (or its JSON text).',
  );

export const RecipeInput = z
  .unknown()
  .optional()
  .describe(
    'The recipe’s input, as its JSON Schema in algoviz_list_recipes describes it. Short notations work: a list "5 2 4 6 1 3", a graph "A-B 4, B-C 2" ("->" for directed edges), operations "insert 4, delete 3", and an input may be its main field alone, such as the graph. Left out, the recipe runs on its first example.',
  );

/** The arguments of a tool that draws a document or a recipe. */
export const sourceArgs = {
  document: Document.optional().describe(
    'The visualization document: a JSON object with version, structures and steps (or its JSON text). Give it, or a recipe instead.',
  ),
  recipe: z
    .string()
    .optional()
    .describe(
      'A recipe id from algoviz_list_recipes, such as "dijkstra", in place of a document: the tool runs it on `input`.',
    ),
  input: RecipeInput,
};

export interface SourceArgs {
  readonly document?: unknown;
  readonly recipe?: string | undefined;
  readonly input?: unknown;
}

/** The document the arguments name: given, or a recipe's run. */
export function sourceOf({
  document,
  recipe,
  input,
}: SourceArgs): Result<unknown, readonly Diagnostic[]> {
  if (recipe !== undefined) {
    if (document !== undefined)
      return err([
        argumentError('$.document', 'Give a document or a recipe, not both'),
      ]);
    return runRecipe(recipe, input);
  }
  if (input !== undefined)
    return err([
      argumentError(
        '$.input',
        'An input goes with a recipe; name it in `recipe`',
      ),
    ]);
  if (document === undefined)
    return err([
      argumentError('$', 'Give a document, or a recipe with its input'),
    ]);
  return ok(document);
}

const argumentError = (path: string, message: string): Diagnostic => ({
  code: 'INVALID_ARGUMENT',
  path,
  message,
});
