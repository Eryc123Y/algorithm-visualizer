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
  edgesPerStructure: 4_000,
  tableRows: 100,
  tableColumns: 100,
  steps: 10_000,
  actionsPerStep: 100,
  textLength: 2_000,
  sourceLength: 20_000,
} as const;

/**
 * Whether a name can be used as an object key without colliding with
 * properties every JavaScript object inherits, such as `constructor` or
 * `__proto__`. Names that collide could resolve to inherited values or
 * change an object's prototype.
 */
export const isSafeKey = (name: string): boolean => !(name in Object.prototype);

const RESERVED =
  'must not be a built-in JavaScript property name such as "constructor" or "__proto__"';

/** Name of a structure in a visualization; actions refer to it as `target`. */
export const StructureName = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/)
  .refine(isSafeKey, { message: `Structure names ${RESERVED}` })
  .describe(
    `Identifier of a structure, e.g. "arr" or "dist". Letters, digits and underscores; must not start with a digit; ${RESERVED}.`,
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
      .record(
        z.string().refine(isSafeKey, { message: `Variable names ${RESERVED}` }),
        z.json(),
      )
      .optional()
      .describe('Variable values to display, e.g. { "i": 0, "j": 1 }.'),
  })
  .describe('Teaching metadata for a step.');
export type StepMeta = z.infer<typeof StepMeta>;

/** Source code shown next to the visualization; steps refer to its lines. */
export const Source = z
  .strictObject({
    language: z
      .string()
      .regex(/^[a-z0-9+#-]{1,32}$/)
      .optional()
      .describe('Language for syntax highlighting, e.g. "python" or "c".'),
    code: z.string().max(LIMITS.sourceLength).describe('The source code.'),
  })
  .describe(
    "Source code of the algorithm. When present, each step's `meta.line` must be a line of this code.",
  );
export type Source = z.infer<typeof Source>;

/** An element with an explicit id: a cell, a stack entry, a list node, … */
export const Element = z
  .strictObject({ id: ElementId, value: Scalar })
  .describe('An element with an explicit id.');
export type Element = z.infer<typeof Element>;

/**
 * Authoring form of an element: either explicit, or a bare value that the
 * parser gives a generated id.
 */
export const ElementInput = z
  .union([Element, Scalar])
  .describe(
    'An element `{ "id", "value" }`, or a bare value to get a generated id.',
  );
export type ElementInput = z.infer<typeof ElementInput>;

export const isElement = (x: ElementInput): x is Element =>
  typeof x === 'object' && x !== null;

/** Name of a pointer or cursor, e.g. "i", "lo", "head". */
export const PointerName = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]{0,15}$/)
  .refine(isSafeKey, { message: `Pointer names ${RESERVED}` })
  .describe('Pointer name, e.g. "i", "lo" or "head".');

/**
 * Categorical group of an element (0–5), e.g. a connected component or a
 * colour class in graph colouring. Painters map groups to distinct tones.
 * null removes the group.
 */
export const Group = z.int().min(0).max(5).nullable();

/**
 * Custom issue parameter used to tag Zod issues with a protocol error code.
 * See `errors.ts`.
 */
export const PROTOCOL_CODE_PARAM = 'protocolCode';
