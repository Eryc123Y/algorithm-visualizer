/**
 * The tools an MCP client sees, independent of any transport: the MCP
 * server registers them, and the evaluation harness calls them directly.
 */
import { formatErrors, type Diagnostic } from '@algoviz/spec';
import { z } from 'zod';

import { guide } from './guide.ts';
import { formatInspect, inspect, MAX_FRAMES } from './inspect.ts';
import { listRecipes, recipeCatalog, runRecipe } from './recipes.ts';
import { render } from './render.ts';
import { formatReport, validate } from './validate.ts';

export interface ToolResult {
  readonly text: string;
  readonly isError?: boolean;
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

export const Document = z
  .union([z.record(z.string(), z.unknown()), z.string()])
  .describe(
    'The visualization document: a JSON object with version, structures and steps (or its JSON text).',
  );

export const tools: readonly ToolDefinition[] = [
  tool({
    name: 'algoviz_guide',
    title: 'Read the authoring guide',
    description:
      'How to write an algoviz visualization document: the document format, steps and marks, and every structure kind with its actions and an example. Read it before writing a document. Pass `kinds` to read only the kinds you need.',
    input: z.strictObject({
      kinds: z
        .array(z.string())
        .optional()
        .describe(
          'Structure kinds to include, e.g. ["array", "graph"]. Default: all of array, stack, queue, linkedList, tree, graph, table, hashTable.',
        ),
    }),
    run({ kinds }) {
      const text = guide(kinds);
      return text.ok ? { text: text.value } : failure(text.error);
    },
  }),
  tool({
    name: 'algoviz_validate',
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
    name: 'algoviz_inspect',
    title: 'Inspect frames',
    description: `Shows the state of every structure at chosen frames: data, marks such as pointers or visited nodes, and the step's narration and line. Frame 0 is the initial state and frame n the state after step n; negative numbers count from the end (-1 is the last). Use it to check that a valid document does what you meant, e.g. that an array ends up sorted. At most ${MAX_FRAMES} frames per call.`,
    input: z.strictObject({
      document: Document,
      frames: z
        .array(z.int())
        .min(1)
        .max(MAX_FRAMES)
        .optional()
        .describe('Frame numbers, e.g. [0, 5, -1]. Default [-1].'),
    }),
    run({ document, frames }) {
      const report = inspect(document, frames);
      return report.ok
        ? { text: formatInspect(report.value) }
        : failure(report.error);
    },
  }),
  tool({
    name: 'algoviz_render',
    title: 'Render a frame',
    description:
      'Draws one frame of a valid document as a standalone SVG image, as the player would show it.',
    input: z.strictObject({
      document: Document,
      frame: z
        .int()
        .optional()
        .describe('Frame number; negative counts from the end. Default -1.'),
      theme: z.enum(['light', 'dark']).optional().describe('Default "light".'),
    }),
    run({ document, frame, theme }) {
      const result = render(document, {
        ...(frame === undefined ? {} : { frame }),
        ...(theme === undefined ? {} : { theme }),
      });
      return result.ok ? { text: result.value.svg } : failure(result.error);
    },
  }),
  tool({
    name: 'algoviz_list_recipes',
    title: 'List recipes',
    description: `Lists ready-made visualizations of classic algorithms (${recipeCatalog.length}: sorting, searching, lists, trees, graphs, dynamic programming, hashing) with the arguments each takes. A recipe produces a complete, narrated document for your own input; prefer one when it matches what is asked.`,
    input: z.strictObject({}),
    run() {
      return { text: JSON.stringify(listRecipes()) };
    },
  }),
  tool({
    name: 'algoviz_run_recipe',
    title: 'Run a recipe',
    description:
      'Builds the document for a recipe from algoviz_list_recipes with the given arguments, e.g. name "dijkstra" with args { "graph": { "nodes": ["A", "B"], "edges": [["A", "B", 3]] }, "source": "A" }. Returns the document as JSON, already validated.',
    input: z.strictObject({
      name: z.string().describe('Recipe name, e.g. "bubbleSort".'),
      args: z
        .record(z.string(), z.unknown())
        .describe('Arguments as listed for the recipe.'),
    }),
    run({ name, args }) {
      const doc = runRecipe(name, args);
      return doc.ok ? { text: JSON.stringify(doc.value) } : failure(doc.error);
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
