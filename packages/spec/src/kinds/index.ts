/**
 * Registry of built-in structure kinds.
 */
import type { z } from 'zod';

import { ArrayAction, ArrayDecl, ArrayDeclInput } from './array.ts';

export * from './array.ts';

/** Per-kind schemas the parser needs to look up by `kind`. */
interface KindSchemas {
  readonly decl: z.ZodType;
  readonly declInput: z.ZodType;
  readonly action: z.ZodDiscriminatedUnion<
    readonly z.ZodObject<{ type: z.ZodLiteral<string> }>[]
  >;
}

export const kinds = {
  array: { decl: ArrayDecl, declInput: ArrayDeclInput, action: ArrayAction },
} as const satisfies Record<string, KindSchemas>;

export type StructureKindName = keyof typeof kinds;

/** The action `type` values defined for a kind, e.g. `['set', 'swap', …]`. */
export function actionTypesOf(kind: StructureKindName): string[] {
  return kinds[kind].action.options.map((option) => option.shape.type.value);
}
