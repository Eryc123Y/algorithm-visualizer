/**
 * Shared pieces of the linear element kinds (stack, queue, linked list).
 */
import { z } from 'zod';

import type { ElementInput } from '../common.ts';
import { Element, Index, isElement, LIMITS, Scalar } from '../common.ts';
import type { ActionContext, IdRef } from './kind.ts';

export const Elements = z.array(Element).max(LIMITS.elementsPerStructure);

/** Bare values or explicit elements; bare values get ids e0, e1, … */
export const ElementsInput = z
  .union([Elements, z.array(Scalar).max(LIMITS.elementsPerStructure)])
  .describe(
    'Initial contents: bare values like [5, 3] (ids "e0", "e1", … are generated) or elements like [{ "id": "a", "value": 5 }].',
  );

export const normalizeElements = (
  input: readonly (Element | Scalar)[],
): Element[] =>
  input.map((x, k) => (isElement(x) ? x : { id: `e${k}`, value: x }));

export const Indices = z.array(Index).min(1).max(LIMITS.elementsPerStructure);

export const elementIds = (
  elements: readonly Element[],
  key = 'initial',
): IdRef[] => elements.map((e, k) => ({ id: e.id, path: [key, k, 'id'] }));

/** Gives a bare-value `element` field, if the action has one, a generated id. */
export function normalizeElementField<A extends object>(
  action: A,
  ctx: ActionContext,
): A {
  if (!('element' in action)) return action;
  const element = action.element as ElementInput;
  if (isElement(element)) return action;
  return { ...action, element: { id: ctx.allocateId('e'), value: element } };
}

export const elementFieldIds = (action: { element: Element }): IdRef[] => [
  { id: action.element.id, path: ['element', 'id'] },
];
