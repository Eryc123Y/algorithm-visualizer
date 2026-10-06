/**
 * The contract every structure kind implements on the protocol side
 * (ADR 0012). The parser only talks to kinds through this interface, so a
 * new kind (a Turing machine tape, a number line, …) is one new module plus
 * one registry entry.
 */
import type { z } from 'zod';

/** An id together with where it appears, relative to its declaration or action. */
export interface IdRef {
  readonly id: string;
  readonly path: readonly PropertyKey[];
}

/** Services the parser offers while normalising an action. */
export interface ActionContext {
  /**
   * Returns an id of the form `${prefix}${n}` that is not yet used in this
   * structure, and reserves it. Used to give shorthand elements ids.
   */
  allocateId(prefix: string): string;
}

/** The types a kind is made of. */
export interface KindTypes {
  /** Canonical declaration, as renderers see it. */
  readonly decl: { readonly kind: string };
  /** Authoring declaration; may allow shorthands. */
  readonly declInput: { readonly kind: string };
  /** Canonical action. */
  readonly action: { readonly type: string };
  /** Authoring action; may allow shorthands. */
  readonly actionInput: { readonly type: string };
}

export interface KindSpec<T extends KindTypes> {
  readonly kind: T['decl']['kind'];
  readonly decl: z.ZodType<T['decl']>;
  readonly declInput: z.ZodType<T['declInput']>;
  readonly action: z.ZodType<T['action']>;
  readonly actionInput: z.ZodType<T['actionInput']>;
  /** Every action `type` the kind defines, for error hints. */
  readonly actionTypes: readonly string[];
  /** Expands declaration shorthands into the canonical form. */
  normalizeDecl(input: T['declInput']): T['decl'];
  /** Ids present in a declaration; they must be unique within it. */
  declIds(decl: T['decl']): readonly IdRef[];
  /** Expands action shorthands, allocating ids where needed. */
  normalizeAction(input: T['actionInput'], ctx: ActionContext): T['action'];
  /** Ids an action introduces; they must not have been used before. */
  introducedIds(action: T['action']): readonly IdRef[];
}

/** The action `type` literals of a discriminated union of object schemas. */
export const typesOf = (
  union: z.ZodDiscriminatedUnion<
    readonly z.ZodObject<{ type: z.ZodLiteral<string> }>[]
  >,
): string[] => union.options.map((option) => option.shape.type.value);

export const noIds = (): readonly IdRef[] => [];
