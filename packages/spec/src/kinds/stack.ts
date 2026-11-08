/**
 * The `stack` kind: last in, first out. Positions count from the bottom (0).
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

export const StackDecl = z
  .strictObject({
    kind: z.literal('stack'),
    label: z.string().max(LIMITS.textLength).optional(),
    place: Place.optional(),
    initial: Elements.describe('Elements from bottom to top.'),
  })
  .describe('A stack (last in, first out).');
export type StackDecl = z.infer<typeof StackDecl>;

export const StackDeclInput = StackDecl.extend({ initial: ElementsInput });
export type StackDeclInput = z.infer<typeof StackDeclInput>;

const actions = <E extends z.ZodType>(element: E) =>
  z.discriminatedUnion('type', [
    z
      .strictObject({ type: z.literal('push'), element })
      .describe('Push `element` on top.'),
    z
      .strictObject({ type: z.literal('pop') })
      .describe('Remove the top element.'),
    z
      .strictObject({ type: z.literal('peek') })
      .describe('Highlight the top element (this step only).'),
    z
      .strictObject({ type: z.literal('highlight'), indices: Indices })
      .describe(
        'Highlight positions counted from the bottom (this step only).',
      ),
  ]);

export const StackAction = actions(Element);
export type StackAction = z.infer<typeof StackAction>;
export const StackActionInput = actions(ElementInput);
export type StackActionInput = z.infer<typeof StackActionInput>;

export const stackSpec: KindSpec<{
  decl: StackDecl;
  declInput: StackDeclInput;
  action: StackAction;
  actionInput: StackActionInput;
}> = {
  kind: 'stack',
  decl: StackDecl,
  declInput: StackDeclInput,
  action: StackAction,
  actionInput: StackActionInput,
  actionTypes: typesOf(StackAction),
  normalizeDecl: (input) => ({
    ...input,
    initial: normalizeElements(input.initial),
  }),
  declIds: (decl) => elementIds(decl.initial),
  normalizeAction: (action, ctx) =>
    normalizeElementField(action, ctx) as StackAction,
  introducedIds: (action) =>
    action.type === 'push' ? elementFieldIds(action) : [],
};
