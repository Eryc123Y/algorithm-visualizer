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
  LIMITS,
  PROTOCOL_VERSION,
  Source,
  StepMeta,
  StructureName,
} from './common.ts';
import { ArrayAction, ArrayDecl, ArrayDeclInput } from './kinds/index.ts';

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

/** Any built-in action, tagged with the structure it applies to. */
export const TargetedAction = z.discriminatedUnion(
  'type',
  withTargets(ArrayAction.options),
);
export type TargetedAction = z.infer<typeof TargetedAction>;

export const StructureDecl = z.discriminatedUnion('kind', [ArrayDecl]);
export type StructureDecl = z.infer<typeof StructureDecl>;

export const StructureDeclInput = z.discriminatedUnion('kind', [
  ArrayDeclInput,
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
  z.strictObject({
    version: z
      .literal(PROTOCOL_VERSION)
      .describe(`Protocol version; must be "${PROTOCOL_VERSION}".`),
    title: z.string().max(LIMITS.textLength).optional(),
    source: Source.optional(),
    structures: structures(decl),
    steps: steps(action),
  });

export const Visualization = document(StructureDecl, TargetedAction).describe(
  'A step-by-step visualization in canonical form.',
);
export type Visualization = z.infer<typeof Visualization>;
export type Step = Visualization['steps'][number];

export const VisualizationInput = document(
  StructureDeclInput,
  TargetedAction,
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
