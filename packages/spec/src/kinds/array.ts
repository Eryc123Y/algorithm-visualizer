/**
 * The `array` structure kind: a sequence of elements with stable ids.
 *
 * Mark semantics (implemented by the core reducer, documented here because
 * they are part of the protocol):
 * - `compare`, `highlight` and the swap mark set by `swap` are transient:
 *   they last for one step.
 * - `pointer` and `settle` persist until changed.
 *
 * An array may carry a pattern (ADR 0037): a second row under the text,
 * shifted so that its first element sits under text position `shift`.
 * `align` moves it and `check` compares one of its elements with the text
 * above; the reducer decides whether they match. The text is fixed while
 * a pattern is aligned under it.
 */
import { z } from 'zod';

import {
  Element,
  ElementInput,
  Index,
  isElement,
  LIMITS,
  Place,
  PointerName,
  Scalar,
} from '../common.ts';
import { typesOf, type DeclIssue, type KindSpec } from './kind.ts';

/** @deprecated Use `Element`; kept as the array-specific name. */
export const ArrayElement = Element;
export type ArrayElement = Element;

const View = z
  .enum(['row', 'tree', 'heap'])
  .optional()
  .describe(
    'How to draw the array: "row" (default); "tree", a complete binary tree where index i has children 2i+1 and 2i+2; or "heap", that tree with the row under it, both drawn from the one array, as textbooks draw heaps.',
  );

/** Most elements a pattern holds. */
export const MAX_PATTERN = 64;

const Shift = z
  .int()
  .min(0)
  .max(LIMITS.elementsPerStructure)
  .optional()
  .describe(
    'Text position under which the pattern starts, from 0 to the text length (default 0).',
  );

/** Canonical declaration: every element has an explicit id. */
export const ArrayDecl = z
  .strictObject({
    kind: z.literal('array'),
    label: z.string().max(LIMITS.textLength).optional(),
    place: Place.optional(),
    view: View,
    initial: z.array(Element).max(LIMITS.elementsPerStructure),
    pattern: z.array(Element).min(1).max(MAX_PATTERN).optional(),
    shift: Shift,
  })
  .describe('An array structure.');
export type ArrayDecl = z.infer<typeof ArrayDecl>;

/**
 * Authoring declaration: `initial` may also be a list of bare values, which
 * are given ids e0, e1, …
 */
export const ArrayDeclInput = ArrayDecl.extend({
  initial: z
    .union([
      z.array(Element).max(LIMITS.elementsPerStructure),
      z.array(Scalar).max(LIMITS.elementsPerStructure),
    ])
    .describe(
      'Initial contents: either bare values like [5, 3, 8] (ids "e0", "e1", … are generated) or elements like [{ "id": "a", "value": 5 }].',
    ),
  pattern: z
    .union([
      z.array(Element).min(1).max(MAX_PATTERN),
      z.array(Scalar).min(1).max(MAX_PATTERN),
    ])
    .optional()
    .describe(
      'A pattern drawn under the text at `shift`, for string matching: values (ids "p0", "p1", … are generated) or elements.',
    ),
});
export type ArrayDeclInput = z.infer<typeof ArrayDeclInput>;

/** Expands the bare-value shorthand into explicit elements (ADR 0007). */
export function normalizeArrayDecl(input: ArrayDeclInput): ArrayDecl {
  const initial = input.initial.map((x, k): Element =>
    isElement(x) ? x : { id: `e${k}`, value: x },
  );
  const { pattern: given, ...rest } = input;
  if (given === undefined) return { ...rest, initial };
  // Generated pattern ids skip the ids already written.
  const taken = new Set([
    ...initial.map((e) => e.id),
    ...given.filter(isElement).map((e) => e.id),
  ]);
  let next = 0;
  const fresh = (): string => {
    while (taken.has(`p${next}`)) next++;
    return `p${next++}`;
  };
  const pattern = given.map((x): Element =>
    isElement(x) ? x : { id: fresh(), value: x },
  );
  return { ...rest, initial, pattern };
}

/** A pattern needs the row view, and its shift is within the text. */
export function validateArrayDecl(decl: ArrayDecl): DeclIssue[] {
  const issues: DeclIssue[] = [];
  if (decl.pattern !== undefined && (decl.view ?? 'row') !== 'row')
    issues.push({
      path: ['pattern'],
      message: `A pattern is drawn under a row; the "${decl.view}" view has none`,
      hint: 'Leave out `view`, or set it to "row".',
    });
  if (decl.shift !== undefined && decl.pattern === undefined)
    issues.push({
      path: ['shift'],
      message: 'A shift places a pattern, and this array has none',
    });
  if ((decl.shift ?? 0) > decl.initial.length)
    issues.push({
      path: ['shift'],
      message: `The shift is ${decl.shift}, past the text of ${decl.initial.length} elements`,
      hint: `Valid shifts are 0 to ${decl.initial.length}.`,
    });
  return issues;
}

const Indices = z.array(Index).min(1).max(LIMITS.elementsPerStructure);

const actions = <E extends z.ZodType>(element: E) =>
  z.discriminatedUnion('type', [
    // Actions that change data.
    z
      .strictObject({ type: z.literal('set'), index: Index, value: Scalar })
      .describe('Replace the value at `index`; the element keeps its id.'),
    z
      .strictObject({ type: z.literal('swap'), i: Index, j: Index })
      .describe(
        'Swap the elements at positions `i` and `j`, marking both as swapped for this step.',
      ),
    z
      .strictObject({ type: z.literal('insert'), index: Index, element })
      .describe(
        'Insert `element` before position `index`; `index` equal to the length appends.',
      ),
    z
      .strictObject({ type: z.literal('remove'), index: Index })
      .describe('Remove the element at `index`.'),
    // Actions that only change marks.
    z
      .strictObject({ type: z.literal('compare'), i: Index, j: Index })
      .describe(
        'Mark positions `i` and `j` as being compared (this step only).',
      ),
    z
      .strictObject({ type: z.literal('highlight'), indices: Indices })
      .describe('Highlight the given positions (this step only).'),
    z
      .strictObject({
        type: z.literal('pointer'),
        name: PointerName,
        index: Index.nullable(),
      })
      .describe(
        'Point the named pointer (e.g. "i", "lo") at `index`; null removes it.',
      ),
    z
      .strictObject({ type: z.literal('settle'), index: Index })
      .describe('Mark the element at `index` as in its final position.'),
    // Actions on the pattern (ADR 0037).
    z
      .strictObject({
        type: z.literal('align'),
        shift: z.int().min(0).max(LIMITS.elementsPerStructure),
        matched: z.int().min(0).max(MAX_PATTERN).optional(),
      })
      .describe(
        'Move the pattern so that its first element is under text position `shift`; its first `matched` elements (default 0) are marked as matched, and must equal the text above them.',
      ),
    z
      .strictObject({ type: z.literal('check'), j: Index })
      .describe(
        'Compare pattern element `j` with the text element above it (position shift + j): both are marked as compared in this step, and if they are equal, `j` is marked as matched until the next `align`.',
      ),
  ]);

export const ArrayAction = actions(Element);
export type ArrayAction = z.infer<typeof ArrayAction>;

/** Authoring actions: `insert` also accepts a bare value. */
export const ArrayActionInput = actions(ElementInput);
export type ArrayActionInput = z.infer<typeof ArrayActionInput>;

export const arraySpec: KindSpec<{
  decl: ArrayDecl;
  declInput: ArrayDeclInput;
  action: ArrayAction;
  actionInput: ArrayActionInput;
}> = {
  kind: 'array',
  decl: ArrayDecl,
  declInput: ArrayDeclInput,
  action: ArrayAction,
  actionInput: ArrayActionInput,
  actionTypes: typesOf(ArrayAction),
  normalizeDecl: normalizeArrayDecl,
  declIds: (decl) => [
    ...decl.initial.map((e, k) => ({ id: e.id, path: ['initial', k, 'id'] })),
    ...(decl.pattern ?? []).map((e, k) => ({
      id: e.id,
      path: ['pattern', k, 'id'],
    })),
  ],
  validateDecl: validateArrayDecl,
  normalizeAction: (action, ctx) =>
    action.type === 'insert' && !isElement(action.element)
      ? {
          ...action,
          element: { id: ctx.allocateId('e'), value: action.element },
        }
      : (action as ArrayAction),
  introducedIds: (action) =>
    action.type === 'insert'
      ? [{ id: action.element.id, path: ['element', 'id'] }]
      : [],
};
