/**
 * The `array` structure kind: a sequence of elements with stable ids.
 *
 * Mark semantics (implemented by the core reducer, documented here because
 * they are part of the protocol):
 * - `compare`, `highlight` and the swap mark set by `swap` are transient:
 *   they last for one step.
 * - `pointer` and `settle` persist until changed.
 */
import { z } from 'zod';

import {
  Element,
  ElementInput,
  Index,
  isElement,
  LIMITS,
  PointerName,
  Scalar,
} from '../common.ts';
import { typesOf, type KindSpec } from './kind.ts';

/** @deprecated Use `Element`; kept as the array-specific name. */
export const ArrayElement = Element;
export type ArrayElement = Element;

const View = z
  .enum(['row', 'tree'])
  .optional()
  .describe(
    'How to draw the array: "row" (default) or "tree", a complete binary tree where index i has children 2i+1 and 2i+2, as for heaps.',
  );

/** Canonical declaration: every element has an explicit id. */
export const ArrayDecl = z
  .strictObject({
    kind: z.literal('array'),
    label: z.string().max(LIMITS.textLength).optional(),
    view: View,
    initial: z.array(Element).max(LIMITS.elementsPerStructure),
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
});
export type ArrayDeclInput = z.infer<typeof ArrayDeclInput>;

/** Expands the bare-value shorthand into explicit elements (ADR 0007). */
export function normalizeArrayDecl(input: ArrayDeclInput): ArrayDecl {
  const initial = input.initial.map((x, k): Element =>
    isElement(x) ? x : { id: `e${k}`, value: x },
  );
  return { ...input, initial };
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
  declIds: (decl) =>
    decl.initial.map((e, k) => ({ id: e.id, path: ['initial', k, 'id'] })),
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
