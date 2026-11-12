/**
 * An algorithm, or one operation of a data structure, as a module of the
 * registry (ADR 0019): its id, what it is, its input schema, examples, its
 * code in every language and how it records a run.
 */
import type { AnchoredSource } from '@algoviz/spec';
import type { z } from 'zod';

import { withMainField } from './notation/schema.ts';
import { LANGUAGES, listing, type Language, type Snippet } from './snippet.ts';
import type { Trace } from './trace.ts';

/** Topics that group modules in menus, in the order menus show them. */
export const TOPICS = [
  'sorting',
  'searching',
  'lists',
  'trees',
  'heaps',
  'hashing',
  'graphs',
  'dynamic-programming',
  'greedy',
  'strings',
  'geometry',
] as const;
export type Topic = (typeof TOPICS)[number];

/** The heading of each topic in menus. */
export const TOPIC_TITLES: Readonly<Record<Topic, string>> = {
  sorting: 'Sorting',
  searching: 'Searching',
  lists: 'Lists, stacks and queues',
  trees: 'Trees',
  heaps: 'Heaps',
  hashing: 'Hashing',
  graphs: 'Graphs',
  'dynamic-programming': 'Dynamic programming',
  greedy: 'Greedy algorithms',
  strings: 'String matching',
  geometry: 'Computational geometry',
};

/** What an operation returns: found or not, a popped value, or nothing. */
export type OpResult = number | boolean | null;

/** What a run returns besides its document. */
export interface RunOutcome {
  /** One result per operation run. */
  readonly results?: readonly OpResult[];
  /** The final state of a data structure, in the form its `from` takes. */
  readonly after?: unknown;
}

/** The title and code a run shows. */
export interface Presentation {
  readonly title: string;
  readonly sources: readonly AnchoredSource[];
}

export interface Algorithm<I = unknown> {
  /**
   * Stable, lower-case kebab-case id, such as `insertion-sort`; an
   * operation of a data structure is `structure.operation`, such as
   * `bst.delete`. Never reused for something else.
   */
  readonly id: string;
  /** E.g. "Insertion sort". */
  readonly title: string;
  readonly topic: Topic;
  /** One sentence, for catalogues and MCP. */
  readonly summary: string;
  /** The only definition of the input: validation, types, JSON Schema. */
  readonly input: z.ZodType<I>;
  /** At least one; the first is the default in menus and tests. */
  readonly examples: readonly [I, ...I[]];
  /** The code in every language, with the same anchors. */
  readonly code: Readonly<Record<Language, Snippet>>;
  /**
   * The title and code a run on `input` shows, when they depend on the
   * input: a sequence of operations shows only the code of the operations
   * it runs. By default, `title` and `code`.
   */
  present?(input: I): Presentation;
  /**
   * Records the run on `trace`, for an input that passed `input`. Throws a
   * RangeError for an input it cannot show, saying why.
   */
  run(input: I, trace: Trace): RunOutcome | void;
}

/** The anchored sources of code in every language. */
export function sourcesOf(
  code: Readonly<Record<Language, Snippet>>,
): AnchoredSource[] {
  return LANGUAGES.map((language) => ({
    language,
    code: code[language].code,
    anchors: Object.fromEntries(code[language].anchors),
  }));
}

/** An algorithm whose code is given as text with `@anchor` markers. */
export interface AlgorithmDef<S extends z.ZodType> {
  readonly id: string;
  readonly title: string;
  readonly topic: Topic;
  readonly summary: string;
  readonly input: S;
  /**
   * The field a run cannot do without, when it is the only one: the input
   * may then be that field's value alone (ADR 0032).
   */
  readonly main?: S extends z.ZodObject ? keyof S['shape'] & string : never;
  readonly examples: readonly [z.output<S>, ...z.output<S>[]];
  /** The code in each language, with `// @x` and `# @x` markers. */
  readonly code: Readonly<Record<Language, string>>;
  run(input: z.output<S>, trace: Trace): RunOutcome | void;
}

/**
 * Defines an algorithm. Throws unless every language marks the same
 * anchors, so that each step points at a line in each.
 */
export function defineAlgorithm<S extends z.ZodType>(
  def: AlgorithmDef<S>,
): Algorithm<z.output<S>> {
  const { code, input, main, ...rest } = def;
  const schema =
    main === undefined
      ? input
      : withMainField(input as unknown as z.ZodObject, main);
  return {
    ...rest,
    // Zod types an arbitrary schema's output loosely; `S` restates it.
    input: schema as z.ZodType<z.output<S>>,
    code: listing(def.id, code).code,
  };
}
