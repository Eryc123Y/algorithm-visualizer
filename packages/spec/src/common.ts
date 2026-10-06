/**
 * Primitive schemas shared by every structure kind.
 */
import { z } from 'zod';

/** Protocol version this package reads and writes. */
export const PROTOCOL_VERSION = '0.1';

/** Upper bounds that keep a single document cheap to validate and render. */
export const LIMITS = {
  structures: 16,
  elementsPerStructure: 1_000,
  steps: 10_000,
  actionsPerStep: 100,
  textLength: 2_000,
} as const;

/** Name of a structure in a visualization; actions refer to it as `target`. */
export const StructureName = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/)
  .describe(
    'Identifier of a structure, e.g. "arr" or "dist". Letters, digits and underscores; must not start with a digit.',
  );
export type StructureName = z.infer<typeof StructureName>;

/** Stable identity of an element within one structure (ADR 0007). */
export const ElementId = z
  .string()
  .regex(/^[A-Za-z0-9_.:-]{1,64}$/)
  .describe(
    'Identifier of an element, unique within its structure and stable for the whole trace.',
  );
export type ElementId = z.infer<typeof ElementId>;

/** Zero-based position. */
export const Index = z.int().nonnegative().describe('Zero-based position.');
export type Index = z.infer<typeof Index>;

/** A value that can be displayed inside a cell or node. */
export const Scalar = z
  .union([z.number(), z.string().max(LIMITS.textLength), z.boolean(), z.null()])
  .describe('A displayable value: number, string, boolean or null.');
export type Scalar = z.infer<typeof Scalar>;

/** Teaching metadata attached to a step; it never affects structure state. */
export const StepMeta = z
  .strictObject({
    line: z
      .int()
      .positive()
      .optional()
      .describe('1-based source line this step corresponds to.'),
    narration: z
      .string()
      .max(LIMITS.textLength)
      .optional()
      .describe('One or two sentences explaining the step to a learner.'),
    vars: z
      .record(z.string(), z.json())
      .optional()
      .describe('Variable values to display, e.g. { "i": 0, "j": 1 }.'),
  })
  .describe('Teaching metadata for a step.');
export type StepMeta = z.infer<typeof StepMeta>;

/**
 * Custom issue parameter used to tag Zod issues with a protocol error code.
 * See `errors.ts`.
 */
export const PROTOCOL_CODE_PARAM = 'protocolCode';
