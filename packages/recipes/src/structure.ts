/**
 * Data structures as registry modules (ADR 0018, 0019): `defineStructure`
 * turns a model and its operations into one module per operation, such as
 * `bst.delete` with input `{ from, key }`, and a sequence module, such as
 * `bst` with input `{ from, ops }`. Every run starts from the state `from`
 * describes, declared rather than animated, so its steps cover only the
 * operations asked for.
 */
import type { StructureDeclInput, StructureKindName } from '@algoviz/spec';
import { z } from 'zod';

import type {
  Algorithm,
  OpResult,
  Presentation,
  RunOutcome,
  Topic,
} from './algorithm.ts';
import type { Handle } from './recorder.ts';
import { sectionIds } from './section-id.ts';
import {
  joinListings,
  snippetOf,
  type Language,
  type Listing,
  type Snippet,
} from './snippet.ts';
import { listingTrace, type Trace } from './trace.ts';

/** Most operations one run takes. */
export const MAX_OPS = 8;

/** Most values a structure holds, so `after` can always start a new run. */
export const MAX_SIZE = 32;

export interface Applied<S> {
  readonly state: S;
  readonly result: OpResult;
}

/** The arguments of an operation, besides `from`. */
export type Args<Shape extends z.ZodRawShape> = [keyof Shape] extends [never]
  ? Record<never, never>
  : z.output<z.ZodObject<Shape>>;

/** One operation of a structure with states `S`, described by `From`. */
export interface Operation<
  S,
  From,
  K extends StructureKindName,
  Shape extends z.ZodRawShape = z.ZodRawShape,
> {
  /**
   * Lower-case kebab-case: the module id is `<structure>.<name>`, and a
   * call in a sequence is `{ op: name, …args }`.
   */
  readonly name: string;
  /** Lower-case, e.g. "decrease key"; the module's title follows the structure's. */
  readonly title: string;
  /** One sentence, for catalogues. */
  readonly summary: string;
  /** The arguments besides `from`. */
  readonly args: Shape;
  /** At least one input of the operation's module. */
  readonly examples: readonly [
    { readonly from: From } & Args<Shape>,
    ...({ readonly from: From } & Args<Shape>)[],
  ];
  /** The code the operation shows. */
  readonly code: Listing;
  /** The code a call shows, if it depends on the arguments. */
  codeOf?(args: Args<Shape>): Listing;
  /** Lower-case title of a call, e.g. "delete 3". */
  titleOf(args: Args<Shape>): string;
  /**
   * Applies the operation to `state`, recording its steps on `trace` and
   * its actions on `on`. Throws a RangeError for a call the state does not
   * allow, such as a pop from an empty heap.
   */
  apply(state: S, args: Args<Shape>, trace: Trace, on: Handle<K>): Applied<S>;
}

/**
 * Defines operations of one structure, inferring each one's arguments from
 * its `args`.
 */
export const operationsOf =
  <S, From, K extends StructureKindName>() =>
  <const Shape extends z.ZodRawShape>(
    op: Operation<S, From, K, Shape>,
  ): Operation<S, From, K, Shape> =>
    op;

/** A call in a sequence: the operation's name and its arguments. */
export type Call = { readonly op: string } & Record<string, unknown>;

/** One data structure: its model and the operations on it. */
export interface StructureDef<S, From, K extends StructureKindName> {
  /** Lower-case kebab-case id of the sequence module, e.g. `bst`. */
  readonly id: string;
  /** E.g. "Binary search tree". */
  readonly title: string;
  readonly topic: Topic;
  /** One sentence about the sequence module. */
  readonly summary: string;
  /** Name of the structure in the document. */
  readonly name: string;
  readonly kind: K;
  /** The starting states `from` may describe. */
  readonly from: z.ZodType<From>;
  /** At least one input of the sequence module. */
  readonly examples: readonly [
    { readonly from: From; readonly ops: readonly Call[] },
    ...{ readonly from: From; readonly ops: readonly Call[] }[],
  ];
  /** The model state `from` describes; throws a RangeError if it cannot. */
  start(from: From): S;
  /** The state in the form `start` takes. */
  describe(state: S): From;
  /** The declaration that shows `state`, with explicit ids (ADR 0007). */
  declare(state: S): Extract<StructureDeclInput, { readonly kind: K }>;
  /**
   * Removes marks an earlier operation left behind, such as pointers, in
   * the first step of the next one.
   */
  clear(on: Handle<K>): void;
  readonly operations: readonly Operation<S, From, K>[];
}

/** The modules of one structure. */
export interface Structure {
  /** The sequence module, e.g. `bst`. */
  readonly sequence: Algorithm;
  /** One module per operation, e.g. `bst.search`, in the order defined. */
  readonly operations: readonly Algorithm[];
  /** The operations, then the sequence. */
  readonly modules: readonly Algorithm[];
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Splits a call into its operation and arguments. */
function resolve<S, From, K extends StructureKindName>(
  def: StructureDef<S, From, K>,
  call: Call,
) {
  const { op: name, ...args } = call;
  const op = def.operations.find((o) => o.name === name);
  // The input schema admits only known operations.
  if (op === undefined) throw new Error(`Unknown operation "${name}"`);
  return {
    op,
    args,
    title: op.titleOf(args),
    listing: op.codeOf?.(args) ?? op.code,
  };
}

function present<S, From, K extends StructureKindName>(
  def: StructureDef<S, From, K>,
  calls: readonly Call[],
): Presentation {
  const resolved = calls.map((call) => resolve(def, call));
  return {
    title: `${def.title}: ${resolved.map((r) => r.title).join(', ')}`,
    sources: joinListings(resolved.map((r) => r.listing)).sources,
  };
}

/** Runs `calls` in order on the state `from` describes. */
function runCalls<S, From, K extends StructureKindName>(
  def: StructureDef<S, From, K>,
  from: From,
  calls: readonly Call[],
  trace: Trace,
): RunOutcome {
  const resolved = calls.map((call) => resolve(def, call));
  let state = def.start(from);
  const code = joinListings(resolved.map((r) => r.listing));
  const ids = sectionIds(resolved.map((r) => r.title));
  const on = trace.add(def.name, def.declare(state)) as Handle<K>;
  const results = resolved.map(({ op, args, title, listing }, k) => {
    // Each operation is a section (ADR 0020).
    trace.section(ids[k]!, capitalize(title));
    const clear = k > 0 ? () => def.clear(on) : undefined;
    const applied = op.apply(
      state,
      args,
      listingTrace(trace, code, listing, clear),
      on,
    );
    state = applied.state;
    return applied.result;
  });
  return { results, after: def.describe(state) };
}

/** The joined code of `listings` as snippets, one per language. */
function joinedCode(
  listings: readonly Listing[],
): Readonly<Record<Language, Snippet>> {
  const [pseudocode, python] = joinListings(listings).sources.map(snippetOf);
  return { pseudocode: pseudocode!, python: python! };
}

/** The modules of a structure: one per operation, and the sequence. */
export function defineStructure<S, From, K extends StructureKindName>(
  def: StructureDef<S, From, K>,
): Structure {
  checkOperations(def.operations);
  const operations = def.operations.map((op): Algorithm => ({
    id: `${def.id}.${op.name}`,
    title: `${def.title}: ${op.title}`,
    topic: def.topic,
    summary: op.summary,
    input: z.strictObject({ from: def.from, ...op.args }),
    examples: op.examples,
    code: op.code.code,
    present: (input) => present(def, [callOf(op.name, input)]),
    run: (input, trace) =>
      runCalls(def, fromOf(input), [callOf(op.name, input)], trace),
  }));
  const call = z.discriminatedUnion(
    'op',
    def.operations.map((op) =>
      z.strictObject({ op: z.literal(op.name), ...op.args }),
    ) as unknown as [z.ZodObject, ...z.ZodObject[]],
    {
      error: (issue) =>
        issue.code === 'invalid_union'
          ? `Unknown operation; use ${listOf(def.operations.map((o) => o.name))}`
          : undefined,
    },
  );
  const Sequence = z.strictObject({
    from: def.from,
    ops: z
      .array(call)
      .min(1)
      .max(MAX_OPS)
      .describe('Operations, run in order on the starting structure.'),
  });
  const sequence: Algorithm = {
    id: def.id,
    title: def.title,
    topic: def.topic,
    summary: def.summary,
    input: Sequence,
    examples: def.examples,
    code: joinedCode(def.operations.map((op) => op.code)),
    present: (input) => present(def, opsOf(input)),
    run: (input, trace) => runCalls(def, fromOf(input), opsOf(input), trace),
  };
  return { sequence, operations, modules: [...operations, sequence] };
}

/** Kebab-case, as in a step name. */
const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * Throws unless operation names are distinct and kebab-case, and no
 * argument is named `op` or `from`, which a call and an input already use.
 */
function checkOperations(
  operations: readonly { name: string; args: z.ZodRawShape }[],
): void {
  const names = new Set<string>();
  for (const { name, args } of operations) {
    if (!NAME.test(name) || names.has(name))
      throw new Error(`Operation "${name}" needs a distinct kebab-case name`);
    names.add(name);
    for (const key of ['op', 'from'])
      if (Object.hasOwn(args, key))
        throw new Error(
          `Operation "${name}" may not have an argument "${key}"`,
        );
  }
}

const listOf = (names: readonly string[]) =>
  names.length === 1
    ? names[0]!
    : `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`;

// Module inputs have passed their schemas, so these only restate types.
const fromOf = <From>(input: unknown) => (input as { from: From }).from;
const opsOf = (input: unknown) => (input as { ops: readonly Call[] }).ops;
function callOf(op: string, input: unknown): Call {
  const args = Object.entries(input as object).filter(([k]) => k !== 'from');
  return { ...Object.fromEntries(args), op };
}
