/**
 * The notations in input schemas (ADR 0032): a field with a notation is a
 * union of the notation, a string parsed into the structured form, and
 * the structured form itself; and an input may be its main field alone.
 */
import { z } from 'zod';

import { parseIn } from './error.ts';
import { parseGraph, type GraphLimits, type NotatedGraph } from './graph.ts';
import { parseList, type ListKind } from './list.ts';
import {
  parseOperations,
  type NotatedCall,
  type OperationShape,
} from './operations.ts';

/**
 * A field that takes its structured form or a notation: the structured
 * form's output, from its input or a string.
 */
type Field<S extends z.core.$ZodType> = z.ZodType<
  z.output<S>,
  z.input<S> | string
>;

/**
 * `schema` as the end of a pipe from values of type `T`, which it checks
 * again; Zod cannot relate a generic schema's input to them.
 */
const from = <T>(schema: z.core.$ZodType) =>
  schema as unknown as z.ZodType<unknown, T>;

const LIST_FORMS: Readonly<Record<ListKind, string>> = {
  number:
    'numbers separated by commas or spaces, optionally in brackets, e.g. "5 2 4 6 1 3" or "[5, 2, 4]"',
  level:
    'numbers separated by commas or spaces, null for a gap, optionally in brackets, e.g. "[4, 2, 6, 1, 3, null, 7]"',
  word: 'words separated by commas or spaces, e.g. "cat car dog"',
};

/** A list field that also takes the list notation. */
export function listField<A extends z.ZodArray<z.core.$ZodType>>(
  array: A,
  kind: ListKind,
): Field<A> {
  const form = LIST_FORMS[kind];
  const text = z
    .string()
    .transform((s, ctx) =>
      parseIn(
        s,
        ctx,
        (t) => parseList(t, kind, array.element),
        `Write ${form}.`,
      ),
    )
    .pipe(from<ReturnType<typeof parseList>>(array))
    .describe(`The list as text: ${form}.`);
  return z.union([text, array]) as unknown as Field<A>;
}

export const GRAPH_FORM =
  'edges separated by commas, e.g. "A-B 4, B-C 2": "-" joins an undirected edge and "->" a directed one, a weight goes after a space, and a name alone is a node without edges; names are letters, digits and _';

/** A graph field that also takes the edge-list notation. */
export function graphField<G extends z.ZodType>(
  structured: G,
  limits: GraphLimits,
): Field<G> {
  const text = z
    .string()
    .transform((s, ctx) =>
      parseIn(s, ctx, (t) => parseGraph(t, limits), `Write ${GRAPH_FORM}.`),
    )
    .pipe(from<NotatedGraph>(structured))
    .describe(`The graph as text: ${GRAPH_FORM}.`);
  return z.union([text, structured]) as unknown as Field<G>;
}

/**
 * A field of calls that also takes the operation-list notation; `example`
 * is a list of calls in it.
 */
export function operationsField<A extends z.ZodArray<z.core.$ZodType>>(
  array: A,
  operations: readonly OperationShape[],
  example: string,
): Field<A> {
  const calls = operations
    .map((op) => [op.name, ...Object.keys(op.args)].join(' '))
    .join(', ');
  const form = `operations separated by commas, each followed by its arguments, e.g. "${example}"; the operations are ${calls}`;
  const text = z
    .string()
    .transform((s, ctx) =>
      parseIn(s, ctx, (t) => parseOperations(t, operations), `Write ${form}.`),
    )
    .pipe(from<NotatedCall[]>(array))
    .describe(`The operations as text: ${form}.`);
  return z.union([text, array]) as unknown as Field<A>;
}

/**
 * An input that may also be its main field alone, in any of the field's
 * forms (ADR 0032): an object is read as the input first, then as the
 * field.
 */
export function withMainField<O extends z.ZodObject>(
  object: O,
  key: keyof O['shape'] & string,
) {
  const field = object.shape[key] as z.ZodType;
  const alone = field
    .transform((value) => ({ [key]: value }))
    .pipe(from<Record<string, unknown>>(object))
    .describe(`Or the ${key} alone, in any of its forms.`);
  return z.union([object, alone]) as unknown as z.ZodType<z.output<O>, unknown>;
}
