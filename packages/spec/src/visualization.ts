/**
 * Top-level document schemas.
 *
 * Two forms exist (ADR 0007):
 * - `VisualizationInput` is what people and LLMs write; it allows shorthands.
 * - `Visualization` is the canonical form that `parseVisualization` returns
 *   and that renderers consume.
 */
import { z } from 'zod';

import {
  AnchoredSource,
  LIMITS,
  Section,
  Source,
  StepMeta,
  StructureName,
} from './common.ts';
import {
  ArrayAction,
  ArrayActionInput,
  ArrayDecl,
  ArrayDeclInput,
  LinkedListAction,
  LinkedListActionInput,
  LinkedListDecl,
  LinkedListDeclInput,
  QueueAction,
  QueueActionInput,
  QueueDecl,
  QueueDeclInput,
  StackAction,
  StackActionInput,
  StackDecl,
  StackDeclInput,
  TreeAction,
  TreeActionInput,
  TreeDecl,
  TreeDeclInput,
  GraphAction,
  GraphActionInput,
  GraphDecl,
  GraphDeclInput,
  HashTableAction,
  HashTableActionInput,
  HashTableDecl,
  HashTableDeclInput,
  TableAction,
  TableDecl,
  TableDeclInput,
} from './kinds/index.ts';
import { PROTOCOL_VERSIONS } from './version.ts';

const targetField = {
  target: StructureName.describe(
    'Name of the structure this action applies to.',
  ),
};

/**
 * Adds `target` to every option of a tuple of object schemas while keeping
 * each option's own type. `Array.prototype.map` alone would widen the result
 * to an array of a union, and calling `.extend` on a generic `T` would be
 * typed against its constraint, so both shape and config are spelled out.
 */
type WithTarget<T extends readonly z.ZodObject[]> = {
  -readonly [K in keyof T]: T[K] extends z.ZodObject<infer Shape, infer Config>
    ? z.ZodObject<Shape & typeof targetField, Config>
    : never;
};
const withTargets = <const T extends readonly z.ZodObject[]>(options: T) =>
  options.map((option) => option.extend(targetField)) as WithTarget<T>;

/*
 * One entry per kind (ADR 0012). Kinds may share action names (`highlight`
 * exists for arrays and graphs with different fields), so the top level is a
 * plain union of per-kind unions; the parser picks the right one by the
 * target's kind.
 */

/** Any built-in action in canonical form, tagged with its structure. */
export const TargetedAction = z.union([
  z.discriminatedUnion('type', withTargets(ArrayAction.options)),
  z.discriminatedUnion('type', withTargets(StackAction.options)),
  z.discriminatedUnion('type', withTargets(QueueAction.options)),
  z.discriminatedUnion('type', withTargets(LinkedListAction.options)),
  z.discriminatedUnion('type', withTargets(TreeAction.options)),
  z.discriminatedUnion('type', withTargets(GraphAction.options)),
  z.discriminatedUnion('type', withTargets(TableAction.options)),
  z.discriminatedUnion('type', withTargets(HashTableAction.options)),
]);
export type TargetedAction = z.infer<typeof TargetedAction>;

/** Any built-in action in authoring form, tagged with its structure. */
export const TargetedActionInput = z.union([
  z.discriminatedUnion('type', withTargets(ArrayActionInput.options)),
  z.discriminatedUnion('type', withTargets(StackActionInput.options)),
  z.discriminatedUnion('type', withTargets(QueueActionInput.options)),
  z.discriminatedUnion('type', withTargets(LinkedListActionInput.options)),
  z.discriminatedUnion('type', withTargets(TreeActionInput.options)),
  z.discriminatedUnion('type', withTargets(GraphActionInput.options)),
  z.discriminatedUnion('type', withTargets(TableAction.options)),
  z.discriminatedUnion('type', withTargets(HashTableActionInput.options)),
]);
export type TargetedActionInput = z.infer<typeof TargetedActionInput>;

export const StructureDecl = z.discriminatedUnion('kind', [
  ArrayDecl,
  StackDecl,
  QueueDecl,
  LinkedListDecl,
  TreeDecl,
  GraphDecl,
  TableDecl,
  HashTableDecl,
]);
export type StructureDecl = z.infer<typeof StructureDecl>;

export const StructureDeclInput = z.discriminatedUnion('kind', [
  ArrayDeclInput,
  StackDeclInput,
  QueueDeclInput,
  LinkedListDeclInput,
  TreeDeclInput,
  GraphDeclInput,
  TableDeclInput,
  HashTableDeclInput,
]);
export type StructureDeclInput = z.infer<typeof StructureDeclInput>;

const steps = <A extends z.ZodType>(action: A) =>
  z
    .array(
      z
        .strictObject({
          actions: z
            .array(action)
            .max(LIMITS.actionsPerStep)
            .describe(
              'Actions applied in order; a step may have none and only narrate.',
            ),
          meta: StepMeta.optional(),
        })
        .describe('One point on the timeline the learner can step to.'),
    )
    .max(LIMITS.steps);

const structures = <D extends z.ZodType>(decl: D) =>
  z
    .record(StructureName, decl)
    .refine((r) => Object.keys(r).length > 0, {
      message: 'Declare at least one structure',
    })
    .refine((r) => Object.keys(r).length <= LIMITS.structures, {
      message: `Declare at most ${LIMITS.structures} structures`,
    })
    .describe('Structures shown in the visualization, keyed by name.')
    // The refinements above are invisible to JSON Schema; state them there too.
    .meta({ minProperties: 1, maxProperties: LIMITS.structures });

const document = <D extends z.ZodType, A extends z.ZodType>(
  decl: D,
  action: A,
) =>
  z
    .strictObject({
      version: z
        .enum(PROTOCOL_VERSIONS)
        .describe(
          'Protocol version, "major.minor": the oldest version that has every feature the document uses.',
        ),
      title: z.string().max(LIMITS.textLength).optional(),
      source: Source.optional(),
      sources: z
        .array(AnchoredSource)
        .min(1)
        .max(LIMITS.sources)
        .optional()
        .describe(
          'The code in one or more languages, one entry per language, instead of `source`. Steps point into every language at once with `meta.at`.',
        ),
      structures: structures(decl),
      steps: steps(action),
      sections: z
        .array(Section)
        .max(LIMITS.sections)
        .optional()
        .describe(
          'Sections in order of their first step, e.g. one per operation. Steps before the first section belong to none.',
        ),
    })
    // The parser reports both with its own error; state the rule for JSON
    // Schema validators too.
    .meta({ not: { required: ['source', 'sources'] } });

export const Visualization = document(StructureDecl, TargetedAction).describe(
  'A step-by-step visualization in canonical form.',
);
export type Visualization = z.infer<typeof Visualization>;
export type Step = Visualization['steps'][number];

export const VisualizationInput = document(
  StructureDeclInput,
  TargetedActionInput,
).describe(
  'A step-by-step visualization: declared structures plus a timeline of steps, each applying actions to those structures.',
);
export type VisualizationInput = z.infer<typeof VisualizationInput>;

/**
 * First-pass schema used by the parser: actions are only checked for
 * `target` and `type`, so that their payload can then be validated against
 * the schema of the target's kind with precise error messages.
 */
export const Envelope = document(
  StructureDeclInput,
  z.looseObject({ target: StructureName, type: z.string().min(1) }),
);
