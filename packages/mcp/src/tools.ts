/**
 * The tools an MCP client sees, independent of any transport: the MCP
 * server registers them, and the evaluation harness calls them directly.
 */
import { TOPICS } from '@algomotion/recipes';
import {
  formatErrors,
  kindNames,
  type Diagnostic,
  type ShareContent,
} from '@algomotion/spec';
import { themeNames, type ThemeName } from '@algomotion/svg';
import { z } from 'zod';

import { guide } from './guide.ts';
import { formatInspect, inspect, MAX_FRAMES } from './inspect.ts';
import { listRecipes, recipeCatalog, runRecipe } from './recipes.ts';
import { render } from './render.ts';
import { recipeShare } from './share.ts';
import { Document, RecipeInput, sourceArgs, sourceOf } from './source.ts';
import { formatReport, validate } from './validate.ts';

export interface ToolResult {
  readonly text: string;
  readonly isError?: boolean;
  /**
   * What a share link to the result would carry (ADR 0040). The server
   * turns it into a link when it knows the share page's address.
   */
  readonly share?: ShareContent;
}

export interface ToolDefinition<S extends z.ZodObject = z.ZodObject> {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly input: S;
  run(args: z.output<S>): ToolResult;
}

/** Keeps each definition's argument type while listing them together. */
const tool = <S extends z.ZodObject>(t: ToolDefinition<S>) =>
  t as unknown as ToolDefinition;

const failure = (errors: readonly Diagnostic[]): ToolResult => ({
  text: formatErrors(errors),
  isError: true,
});

/** A frame number or a selector (ADR 0020), as tools take them. */
export const FrameSelectorArg = z.union([z.int(), z.string().max(200)]);

const SELECTORS =
  'A frame is a number (0 is the initial state, n the state after step n, -1 the last) or a selector: a step name such as "relax" or "relax#2" (the second step named relax), a step in a section such as "insert-5/relax#2", a section such as "insert-5" (all its frames), or a range "a..b".';

export { Document } from './source.ts';

/** Shows a recipe by name instead of a document, so none is copied. */
const BY_RECIPE =
  'Give the document, or a recipe and its input instead, such as recipe "dijkstra" with input "A-B 4, B-C 1, A-C 7".';

export const tools: readonly ToolDefinition[] = [
  tool({
    name: 'algomotion_guide',
    title: 'Read the authoring guide',
    description:
      'How to write an algomotion visualization document: the document format, steps and marks, and every structure kind with its actions and an example. Read it before writing a document. Pass `kinds` to read only the kinds you need.',
    input: z.strictObject({
      kinds: z
        .array(z.string())
        .optional()
        .describe(
          `Structure kinds to include, e.g. ["array", "graph"]. Default: all of ${kindNames.join(', ')}.`,
        ),
    }),
    run({ kinds }) {
      const text = guide(kinds);
      return text.ok ? { text: text.value } : failure(text.error);
    },
  }),
  tool({
    name: 'algomotion_validate',
    title: 'Validate a document',
    description:
      'Checks a visualization document: its format, then every step replayed against the state it applies to. Returns "Valid" with a summary and any warnings, or each error with its code, its JSON path (e.g. $.steps[3].actions[0].j), a message and a hint. Fix every error and validate again before returning a document.',
    input: z.strictObject({ document: Document }),
    run({ document }) {
      const report = validate(document);
      return { text: formatReport(report), isError: !report.valid };
    },
  }),
  tool({
    name: 'algomotion_inspect',
    title: 'Inspect frames',
    description: `Shows the state of every structure at chosen frames: data, marks such as pointers or visited nodes, and the step's narration, line, name and section. ${SELECTORS} A section's frames run from the frame before its first step, which still shows the step before it, to the frame after its last. Use it to check that a valid document does what you meant, e.g. that an array ends up sorted. At most ${MAX_FRAMES} frames per call. ${BY_RECIPE}`,
    input: z.strictObject({
      ...sourceArgs,
      frames: z
        .array(FrameSelectorArg)
        .min(1)
        .max(MAX_FRAMES)
        .optional()
        .describe(
          'Frames or selectors, e.g. [0, "relax#2", "insert-5", -1]. Default [-1].',
        ),
    }),
    run({ frames, ...source }) {
      const document = sourceOf(source);
      if (!document.ok) return failure(document.error);
      const report = inspect(document.value, frames);
      return report.ok
        ? { text: formatInspect(report.value) }
        : failure(report.error);
    },
  }),
  tool({
    name: 'algomotion_render',
    title: 'Render a frame',
    description: `Draws one frame of a valid document as a standalone SVG image, as the player would show it. ${SELECTORS} A section or range is several frames, so name one of its steps instead. ${BY_RECIPE}`,
    input: z.strictObject({
      ...sourceArgs,
      frame: FrameSelectorArg.optional().describe(
        'Frame number (negative counts from the end) or a selector of one frame, e.g. "relax#2". Default -1.',
      ),
      theme: z
        .enum(themeNames as [ThemeName, ...ThemeName[]])
        .optional()
        .describe(
          `A built-in theme (${themeNames.join(', ')}). Default "light".`,
        ),
      layout: z
        .enum(['wide', 'narrow'])
        .optional()
        .describe(
          'Where structures with "place": "side" go: beside the others ("wide", default, as in the player) or below them ("narrow", as in a column of notes).',
        ),
    }),
    run({ frame, theme, layout, ...source }) {
      const document = sourceOf(source);
      if (!document.ok) return failure(document.error);
      const result = render(document.value, {
        ...(frame === undefined ? {} : { frame }),
        ...(theme === undefined ? {} : { theme }),
        ...(layout === undefined ? {} : { layout }),
      });
      return result.ok ? { text: result.value.svg } : failure(result.error);
    },
  }),
  tool({
    name: 'algomotion_list_recipes',
    title: 'List recipes',
    description: `Lists ready-made visualizations (${recipeCatalog.length}): classic algorithms, and single operations on data structures such as "bst.delete" or "min-heap.pop". Each has an id, a title, a topic (${TOPICS.join(', ')}), a one-sentence summary and the JSON Schema of its input. A recipe produces a complete, narrated document for your own input; prefer one when it matches what is asked. Recipes with a kebab-case id also show their code in pseudocode and Python.`,
    input: z.strictObject({}),
    run() {
      return { text: JSON.stringify(listRecipes()) };
    },
  }),
  tool({
    name: 'algomotion_run_recipe',
    title: 'Run a recipe',
    description:
      'Builds the document of a recipe from algomotion_list_recipes for the given input, e.g. id "bst.delete" with input { "from": "8 3 10 1 6", "key": 3 }, id "dijkstra" with input "A-B 4, B-C 1, A-C 7", or id "bst" with input { "from": [8, 3, 10], "ops": "insert 4, delete 3" }. Returns the document as JSON, already validated. To show or draw a recipe, pass it to algomotion_show or algomotion_render by name instead.',
    input: z.strictObject({
      id: z.string().describe('Recipe id, e.g. "bst.delete" or "dijkstra".'),
      // Any JSON: the recipe's own schema checks it, at paths under $.input.
      input: RecipeInput,
    }),
    run({ id, input }) {
      const doc = runRecipe(id, input);
      return doc.ok
        ? { text: JSON.stringify(doc.value), share: recipeShare(id, input) }
        : failure(doc.error);
    },
  }),
];

export const findTool = (name: string): ToolDefinition | undefined =>
  tools.find((t) => t.name === name);

/** Parses arguments with the tool's schema, then runs it. */
export function callTool(name: string, args: unknown): ToolResult {
  const t = findTool(name);
  if (t === undefined) return { text: `Unknown tool "${name}"`, isError: true };
  const parsed = t.input.safeParse(args ?? {});
  if (!parsed.success)
    return {
      text: `Invalid arguments: ${z.prettifyError(parsed.error)}`,
      isError: true,
    };
  return t.run(parsed.data);
}
