/**
 * The `priorityQueue` kind (ADR 0029): items with keys, kept in key order,
 * for algorithms such as Dijkstra's and Prim's that keep a min-priority
 * queue. Items are named by id, as their positions change with every key
 * change.
 *
 * Order (implemented by the core reducer and layout, documented here
 * because it is part of the protocol):
 * - The front is the item of least key (`order: "min"`, the default) or
 *   greatest key (`"max"`). A null key, no key yet, comes after every
 *   number in either order.
 * - Ties keep insertion order, also after a key change.
 *
 * Marks: `highlight`, `peek` and the mark `setKey` leaves last one step.
 */
import { z } from 'zod';

import {
  Element,
  ElementId,
  ElementInput,
  LIMITS,
  Place,
  Scalar,
} from '../common.ts';
import { typesOf, type KindSpec } from './kind.ts';
import { elementFieldIds, normalizeElementField } from './linear.ts';

/** A key: a number, or null for none yet (∞, or −∞ in a max-queue). */
export const PriorityKey = z
  .number()
  .nullable()
  .describe(
    'The priority: a number, or null for no key yet, drawn as ∞ (−∞ in a max-priority queue) and ordered after every number.',
  );
export type PriorityKey = z.infer<typeof PriorityKey>;

/** An element with its key. */
export const PriorityItem = z
  .strictObject({ id: ElementId, value: Scalar, key: PriorityKey })
  .describe('An item: an element with its key.');
export type PriorityItem = z.infer<typeof PriorityItem>;

/** Authoring form of an item: `id` may be left out, and is then generated. */
export const PriorityItemInput = z
  .strictObject({
    id: ElementId.optional(),
    value: Scalar,
    key: PriorityKey,
  })
  .describe(
    'An item `{ "value", "key" }`, with an `id` to choose one (ids "e0", "e1", … are generated otherwise).',
  );
export type PriorityItemInput = z.infer<typeof PriorityItemInput>;

const Order = z
  .enum(['min', 'max'])
  .optional()
  .describe(
    '"min" (default): the least key is at the front, as for EXTRACT-MIN; "max": the greatest.',
  );

export const PriorityQueueDecl = z
  .strictObject({
    kind: z.literal('priorityQueue'),
    label: z.string().max(LIMITS.textLength).optional(),
    place: Place.optional(),
    order: Order,
    initial: z
      .array(PriorityItem)
      .max(LIMITS.elementsPerStructure)
      .describe('Items in insertion order, which breaks ties between keys.'),
  })
  .describe('A priority queue: items with keys, kept in key order.');
export type PriorityQueueDecl = z.infer<typeof PriorityQueueDecl>;

export const PriorityQueueDeclInput = PriorityQueueDecl.extend({
  initial: z
    .array(PriorityItemInput)
    .max(LIMITS.elementsPerStructure)
    .describe(
      'Items in insertion order, which breaks ties between keys: [{ "value": "A", "key": 0 }, { "value": "B", "key": null }]; give "id" to choose an id.',
    ),
});
export type PriorityQueueDeclInput = z.infer<typeof PriorityQueueDeclInput>;

/** Gives every item of the authoring form an id: e0, e1, … by position. */
export function normalizePriorityQueueDecl(
  input: PriorityQueueDeclInput,
): PriorityQueueDecl {
  const initial = input.initial.map((item, k): PriorityItem => ({
    id: item.id ?? `e${k}`,
    value: item.value,
    key: item.key,
  }));
  return { ...input, initial };
}

const Ids = z.array(ElementId).min(1).max(LIMITS.elementsPerStructure);

const actions = <E extends z.ZodType>(element: E) =>
  z.discriminatedUnion('type', [
    z
      .strictObject({ type: z.literal('insert'), element, key: PriorityKey })
      .describe(
        'INSERT: add `element` with `key`; it takes its place in key order, after items of equal key.',
      ),
    z
      .strictObject({ type: z.literal('extract') })
      .describe(
        'EXTRACT-MIN (or EXTRACT-MAX): remove the item at the front. The queue must not be empty.',
      ),
    z
      .strictObject({
        type: z.literal('setKey'),
        id: ElementId,
        key: PriorityKey,
      })
      .describe(
        'DECREASE-KEY (or INCREASE-KEY): give item `id` a new key; it moves to its place and is highlighted this step.',
      ),
    z
      .strictObject({ type: z.literal('peek') })
      .describe(
        'MINIMUM (or MAXIMUM): highlight the item at the front (this step only).',
      ),
    z
      .strictObject({ type: z.literal('highlight'), ids: Ids })
      .describe('Highlight items by id (this step only).'),
  ]);

export const PriorityQueueAction = actions(Element);
export type PriorityQueueAction = z.infer<typeof PriorityQueueAction>;

/** Authoring actions: `insert` also takes a bare value, given an id. */
export const PriorityQueueActionInput = actions(ElementInput);
export type PriorityQueueActionInput = z.infer<typeof PriorityQueueActionInput>;

export const priorityQueueSpec: KindSpec<{
  decl: PriorityQueueDecl;
  declInput: PriorityQueueDeclInput;
  action: PriorityQueueAction;
  actionInput: PriorityQueueActionInput;
}> = {
  kind: 'priorityQueue',
  decl: PriorityQueueDecl,
  declInput: PriorityQueueDeclInput,
  action: PriorityQueueAction,
  actionInput: PriorityQueueActionInput,
  actionTypes: typesOf(PriorityQueueAction),
  normalizeDecl: normalizePriorityQueueDecl,
  declIds: (decl) =>
    decl.initial.map((item, k) => ({
      id: item.id,
      path: ['initial', k, 'id'],
    })),
  normalizeAction: (action, ctx) =>
    normalizeElementField(action, ctx) as PriorityQueueAction,
  introducedIds: (action) =>
    action.type === 'insert' ? elementFieldIds(action) : [],
};
