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
  ElementId,
  Index,
  LIMITS,
  PROTOCOL_CODE_PARAM,
  Scalar,
} from '../common.ts';

export const ArrayElement = z
  .strictObject({ id: ElementId, value: Scalar })
  .describe('An element with an explicit id.');
export type ArrayElement = z.infer<typeof ArrayElement>;

const ArrayElements = z
  .array(ArrayElement)
  .max(LIMITS.elementsPerStructure)
  .superRefine((elements, ctx) => {
    const seen = new Set<string>();
    elements.forEach((element, i) => {
      if (seen.has(element.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate element id "${element.id}"`,
          path: [i, 'id'],
          params: { [PROTOCOL_CODE_PARAM]: 'DUPLICATE_ID' },
        });
      }
      seen.add(element.id);
    });
  });

/** Canonical declaration: every element has an explicit id. */
export const ArrayDecl = z
  .strictObject({
    kind: z.literal('array'),
    label: z.string().max(LIMITS.textLength).optional(),
    initial: ArrayElements,
  })
  .describe('An array structure.');
export type ArrayDecl = z.infer<typeof ArrayDecl>;

/**
 * Authoring declaration: `initial` may also be a list of bare values, which
 * `normalizeArrayDecl` expands into elements with generated ids.
 */
export const ArrayDeclInput = ArrayDecl.extend({
  initial: z
    .union([ArrayElements, z.array(Scalar).max(LIMITS.elementsPerStructure)])
    .describe(
      'Initial contents: either bare values like [5, 3, 8] (ids "e0", "e1", … are generated) or elements like [{ "id": "a", "value": 5 }].',
    ),
});
export type ArrayDeclInput = z.infer<typeof ArrayDeclInput>;

const isElement = (x: ArrayElement | Scalar): x is ArrayElement =>
  typeof x === 'object' && x !== null;

/** Expands the bare-value shorthand into explicit elements (ADR 0007). */
export function normalizeArrayDecl(input: ArrayDeclInput): ArrayDecl {
  const initial = input.initial.map((x, k): ArrayElement =>
    isElement(x) ? x : { id: `e${k}`, value: x },
  );
  return { ...input, initial };
}

export const ArrayAction = z.discriminatedUnion('type', [
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
    .strictObject({
      type: z.literal('insert'),
      index: Index,
      element: ArrayElement,
    })
    .describe(
      'Insert `element` before position `index`; `index` equal to the length appends.',
    ),
  z
    .strictObject({ type: z.literal('remove'), index: Index })
    .describe('Remove the element at `index`.'),
  // Actions that only change marks.
  z
    .strictObject({ type: z.literal('compare'), i: Index, j: Index })
    .describe('Mark positions `i` and `j` as being compared (this step only).'),
  z
    .strictObject({
      type: z.literal('highlight'),
      indices: z.array(Index).min(1).max(LIMITS.elementsPerStructure),
    })
    .describe('Highlight the given positions (this step only).'),
  z
    .strictObject({
      type: z.literal('pointer'),
      name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,15}$/),
      index: Index.nullable(),
    })
    .describe(
      'Point the named pointer (e.g. "i", "lo") at `index`; null removes it.',
    ),
  z
    .strictObject({ type: z.literal('settle'), index: Index })
    .describe('Mark the element at `index` as in its final position.'),
]);
export type ArrayAction = z.infer<typeof ArrayAction>;
