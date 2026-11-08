/**
 * The `queue` kind: a double-ended queue. Positions count from the front (0).
 *
 * Marks: `highlight` and `peek` last one step.
 */
import { z } from 'zod';

import { Element, ElementInput, LIMITS, Place } from '../common.ts';
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

export const QueueDecl = z
  .strictObject({
    kind: z.literal('queue'),
    label: z.string().max(LIMITS.textLength).optional(),
    place: Place.optional(),
    initial: Elements.describe('Elements from front to back.'),
  })
  .describe('A queue; also supports deque operations at both ends.');
export type QueueDecl = z.infer<typeof QueueDecl>;

export const QueueDeclInput = QueueDecl.extend({ initial: ElementsInput });
export type QueueDeclInput = z.infer<typeof QueueDeclInput>;

const End = z.enum(['front', 'back']);

const actions = <E extends z.ZodType>(element: E) =>
  z.discriminatedUnion('type', [
    z
      .strictObject({ type: z.literal('enqueue'), element })
      .describe('Add `element` at the back.'),
    z
      .strictObject({ type: z.literal('dequeue') })
      .describe('Remove the element at the front.'),
    z
      .strictObject({ type: z.literal('pushFront'), element })
      .describe('Add `element` at the front (deque).'),
    z
      .strictObject({ type: z.literal('popBack') })
      .describe('Remove the element at the back (deque).'),
    z
      .strictObject({ type: z.literal('peek'), end: End.optional() })
      .describe(
        'Highlight the element at `end` (default "front"), this step only.',
      ),
    z
      .strictObject({ type: z.literal('highlight'), indices: Indices })
      .describe('Highlight positions counted from the front (this step only).'),
  ]);

export const QueueAction = actions(Element);
export type QueueAction = z.infer<typeof QueueAction>;
export const QueueActionInput = actions(ElementInput);
export type QueueActionInput = z.infer<typeof QueueActionInput>;

export const queueSpec: KindSpec<{
  decl: QueueDecl;
  declInput: QueueDeclInput;
  action: QueueAction;
  actionInput: QueueActionInput;
}> = {
  kind: 'queue',
  decl: QueueDecl,
  declInput: QueueDeclInput,
  action: QueueAction,
  actionInput: QueueActionInput,
  actionTypes: typesOf(QueueAction),
  normalizeDecl: (input) => ({
    ...input,
    initial: normalizeElements(input.initial),
  }),
  declIds: (decl) => elementIds(decl.initial),
  normalizeAction: (action, ctx) =>
    normalizeElementField(action, ctx) as QueueAction,
  introducedIds: (action) =>
    action.type === 'enqueue' || action.type === 'pushFront'
      ? elementFieldIds(action)
      : [],
};
