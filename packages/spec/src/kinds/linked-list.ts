/**
 * The `linkedList` kind: nodes laid out in a row, with explicit `next` (and,
 * for doubly linked lists, `prev`) pointers.
 *
 * Positions refer to the row, from the left (0). Links are independent of
 * the row, so a reversal can be shown one pointer at a time. `insert` only
 * places a node; wire it in with `link`, as the code being taught would.
 *
 * Marks: `highlight` lasts one step; `visit`, `settle` and `pointer` persist.
 */
import { z } from 'zod';

import {
  Element,
  ElementInput,
  Index,
  LIMITS,
  Place,
  PointerName,
  Scalar,
} from '../common.ts';
import { typesOf, type KindSpec } from './kind.ts';
import {
  elementFieldIds,
  elementIds,
  Elements,
  ElementsInput,
  Indices,
  normalizeElementField,
  normalizeElements,
} from './linear.ts';

const shape = {
  kind: z.literal('linkedList'),
  label: z.string().max(LIMITS.textLength).optional(),
  place: Place.optional(),
  doubly: z
    .boolean()
    .optional()
    .describe('Also keep `prev` pointers (default false).'),
  circular: z
    .boolean()
    .optional()
    .describe('Link the last node back to the first (default false).'),
};

export const LinkedListDecl = z
  .strictObject({
    ...shape,
    initial: Elements.describe(
      'Nodes in order; each is linked to the next (and previous, if doubly linked).',
    ),
  })
  .describe('A singly or doubly linked list.');
export type LinkedListDecl = z.infer<typeof LinkedListDecl>;

export const LinkedListDeclInput = z.strictObject({
  ...shape,
  initial: ElementsInput,
});
export type LinkedListDeclInput = z.infer<typeof LinkedListDeclInput>;

const Field = z.enum(['next', 'prev']);

const actions = <E extends z.ZodType>(element: E) =>
  z.discriminatedUnion('type', [
    z
      .strictObject({ type: z.literal('insert'), index: Index, element })
      .describe(
        'Place a new, unlinked node at row position `index` (equal to the length appends). Use `link` to wire it in.',
      ),
    z
      .strictObject({ type: z.literal('remove'), index: Index })
      .describe(
        'Remove the node at `index`; links that pointed to it become null.',
      ),
    z
      .strictObject({ type: z.literal('set'), index: Index, value: Scalar })
      .describe('Change a node value.'),
    z
      .strictObject({
        type: z.literal('link'),
        from: Index,
        to: Index.nullable(),
        field: Field.optional(),
      })
      .describe(
        'Set the `field` pointer (default "next") of node `from` to node `to`, or null.',
      ),
    z
      .strictObject({
        type: z.literal('pointer'),
        name: PointerName,
        index: Index.nullable(),
      })
      .describe(
        'Point a named pointer (e.g. "head", "curr") at a node; null removes it.',
      ),
    z
      .strictObject({ type: z.literal('highlight'), indices: Indices })
      .describe('Highlight nodes (this step only).'),
    z
      .strictObject({ type: z.literal('visit'), index: Index })
      .describe('Mark a node as visited (persists).'),
    z
      .strictObject({ type: z.literal('settle'), index: Index })
      .describe('Mark a node as final or found (persists).'),
  ]);

export const LinkedListAction = actions(Element);
export type LinkedListAction = z.infer<typeof LinkedListAction>;
export const LinkedListActionInput = actions(ElementInput);
export type LinkedListActionInput = z.infer<typeof LinkedListActionInput>;

export const linkedListSpec: KindSpec<{
  decl: LinkedListDecl;
  declInput: LinkedListDeclInput;
  action: LinkedListAction;
  actionInput: LinkedListActionInput;
}> = {
  kind: 'linkedList',
  decl: LinkedListDecl,
  declInput: LinkedListDeclInput,
  action: LinkedListAction,
  actionInput: LinkedListActionInput,
  actionTypes: typesOf(LinkedListAction),
  normalizeDecl: (input) => ({
    ...input,
    initial: normalizeElements(input.initial),
  }),
  declIds: (decl) => elementIds(decl.initial),
  normalizeAction: (action, ctx) =>
    normalizeElementField(action, ctx) as LinkedListAction,
  introducedIds: (action) =>
    action.type === 'insert' ? elementFieldIds(action) : [],
};
