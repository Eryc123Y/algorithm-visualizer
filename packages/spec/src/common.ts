/**
 * Primitive schemas shared by every structure kind.
 */
import { z } from 'zod';

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
  sections: 1_000,
  /** Longest step name, section id or anchor name (ADR 0020, 0017). */
  nameLength: 40,
  /** Languages in `sources` (ADR 0017). */
  sources: 8,
  /** Anchors in one source. */
  anchors: 1_000,
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

/**
 * Lower-case kebab-case that starts with a letter, so that a selector can
 * tell a name from a frame number (ADR 0020).
 */
const kebabName = (what: string) =>
  z
    .string()
    .max(LIMITS.nameLength)
    .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, {
      message: `${what} must be lower-case kebab-case that starts with a letter, e.g. "fixup-case-3"`,
    });

/**
 * Name of a step, saying what kind of step it is, such as `compare` or
 * `relax`. Names repeat: every relaxation in Dijkstra is named `relax`.
 */
export const StepName = kebabName('A step name').describe(
  `Name of the kind of step, e.g. "compare", "relax" or "fixup-case-3": lower-case kebab-case starting with a letter, at most ${LIMITS.nameLength} characters. Names repeat; selectors such as "relax#3" refer to them.`,
);
export type StepName = z.infer<typeof StepName>;

/**
 * Name of a point in an algorithm's code, such as `swap`, that every
 * language of `sources` maps to its own line (ADR 0017). Anchors are keys
 * of an object, so a name that every object inherits, such as
 * `constructor`, is not allowed.
 */
export const AnchorName = kebabName('An anchor name')
  .refine(isSafeKey, { message: `Anchor names ${RESERVED}` })
  .describe(
    `Name of a point in the code, e.g. "swap" or "relax": lower-case kebab-case starting with a letter, at most ${LIMITS.nameLength} characters.`,
  );
export type AnchorName = z.infer<typeof AnchorName>;

/** Id of a section, unique within a document. */
export const SectionId = kebabName('A section id').describe(
  `Id of a section, unique within the document, e.g. "insert-5": lower-case kebab-case starting with a letter, at most ${LIMITS.nameLength} characters.`,
);
export type SectionId = z.infer<typeof SectionId>;

/**
 * A run of consecutive steps with a title, such as one operation of a
 * sequence. It lasts until the next section starts, or to the end.
 */
export const Section = z
  .strictObject({
    id: SectionId,
    title: z
      .string()
      .min(1)
      .max(LIMITS.textLength)
      .describe('Title shown to learners, e.g. "Insert 5".'),
    start: z
      .int()
      .nonnegative()
      .describe(
        "0-based index of the section's first step. Each section starts after the one before.",
      ),
  })
  .describe(
    'A titled run of consecutive steps, such as one operation of a sequence. It lasts until the next section starts, or to the end of the document.',
  );
export type Section = z.infer<typeof Section>;

/** Teaching metadata attached to a step; it never affects structure state. */
export const StepMeta = z
  .strictObject({
    id: StepName.optional(),
    at: AnchorName.optional().describe(
      'With `sources`: the anchor of the code this step corresponds to, which every source maps to a line.',
    ),
    line: z
      .int()
      .positive()
      .optional()
      .describe(
        'With `source`: the 1-based line this step corresponds to. With `sources`, use `at`.',
      ),
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

const Language = z
  .string()
  .regex(/^[a-z0-9+#-]{1,32}$/)
  .describe(
    'Language of the code, for highlighting and the language switcher, e.g. "pseudocode" or "python".',
  );

const Code = z.string().max(LIMITS.sourceLength).describe('The source code.');

/** Source code shown next to the visualization; steps refer to its lines. */
export const Source = z
  .strictObject({
    language: Language.optional(),
    code: Code,
  })
  .describe(
    "Source code of the algorithm in one language. When present, each step's `meta.line` must be a line of this code.",
  );
export type Source = z.infer<typeof Source>;

/**
 * The code of the algorithm in one language of `sources` (ADR 0017), with
 * the line of each anchor that steps name in `meta.at`.
 */
export const AnchoredSource = z
  .strictObject({
    language: Language,
    code: Code,
    anchors: z
      .record(AnchorName, z.int().positive())
      .refine((a) => Object.keys(a).length <= LIMITS.anchors, {
        message: `Give at most ${LIMITS.anchors} anchors`,
      })
      .describe(
        'The 1-based line of each anchor in this code, e.g. { "swap": 6 }. Every anchor a step names must be here.',
      )
      // The refinement above is invisible to JSON Schema; state it there too.
      .meta({ maxProperties: LIMITS.anchors }),
  })
  .describe('The code of the algorithm in one language, with its anchors.');
export type AnchoredSource = z.infer<typeof AnchoredSource>;

/**
 * Where a structure goes in a figure (ADR 0029). The output's layout
 * decides what "side" means: right of the main structures in a wide
 * figure, below them in a narrow one.
 */
export const Place = z
  .enum(['main', 'side'])
  .describe(
    'Where the structure goes: "main" (default) with the main picture, or "side" for an auxiliary structure such as a queue, a call stack or a table of results. Side structures go right of the main ones in wide figures (slides, the player) and below them in narrow ones (notes).',
  );
export type Place = z.infer<typeof Place>;

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
export const Group = z.literal([0, 1, 2, 3, 4, 5]).nullable();

/** A group index 0–5. */
export type GroupIndexValue = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Custom issue parameter used to tag Zod issues with a protocol error code.
 * See `errors.ts`.
 */
export const PROTOCOL_CODE_PARAM = 'protocolCode';
