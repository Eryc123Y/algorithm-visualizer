/**
 * The `hashTable` kind: a hash table with separate chaining. Each bucket
 * holds a chain of elements, addressed as `bucket` and `index` in the
 * chain. (Open addressing needs no kind of its own: it is an array.)
 *
 * The hash function is the author's: actions name the bucket, and step
 * narration can show the computation.
 *
 * Marks: `highlight` lasts one step; `settle` persists until `resetMarks`.
 */
import { z } from 'zod';

import {
  Element,
  ElementInput,
  Index,
  isElement,
  LIMITS,
  Scalar,
} from '../common.ts';
import { typesOf, type DeclIssue, type IdRef, type KindSpec } from './kind.ts';

const MAX_BUCKETS = 100;

const Bucket = z
  .int()
  .min(0)
  .max(MAX_BUCKETS - 1)
  .describe('Bucket number.');

export const HashTableDecl = z
  .strictObject({
    kind: z.literal('hashTable'),
    label: z.string().max(LIMITS.textLength).optional(),
    buckets: z
      .array(z.array(Element).max(LIMITS.elementsPerStructure))
      .min(1)
      .max(MAX_BUCKETS),
  })
  .describe('A hash table with separate chaining.');
export type HashTableDecl = z.infer<typeof HashTableDecl>;

export const HashTableDeclInput = z
  .strictObject({
    kind: z.literal('hashTable'),
    label: z.string().max(LIMITS.textLength).optional(),
    size: z
      .int()
      .min(1)
      .max(MAX_BUCKETS)
      .optional()
      .describe('Number of buckets; at least the length of `initial`.'),
    initial: z
      .array(z.array(ElementInput).max(LIMITS.elementsPerStructure))
      .max(MAX_BUCKETS)
      .optional()
      .describe(
        'Chains per bucket, e.g. [[10, 20], [], [7]]; bare values get ids e0, e1, … in reading order.',
      ),
    buckets: z
      .array(z.array(Element).max(LIMITS.elementsPerStructure))
      .min(1)
      .max(MAX_BUCKETS)
      .optional()
      .describe(
        'The canonical form: every bucket with explicit elements. Accepted so that parsed documents can be read again.',
      ),
  })
  .refine((d) => d.buckets === undefined || d.initial === undefined, {
    message: 'Give either `initial` or `buckets`, not both',
    path: ['buckets'],
  })
  // The same rule for JSON Schema validators, which cannot run the refinement.
  .meta({ not: { required: ['initial', 'buckets'] } });
export type HashTableDeclInput = z.infer<typeof HashTableDeclInput>;

function normalizeHashTableDecl(input: HashTableDeclInput): HashTableDecl {
  const { size, buckets: given, ...others } = input;
  const { initial = given ?? [], ...rest } = others;
  let next = 0;
  const count = Math.max(size ?? 0, initial.length, 1);
  const buckets = Array.from({ length: count }, (_, b) =>
    (initial[b] ?? []).map((x) =>
      isElement(x) ? x : { id: `e${next++}`, value: x },
    ),
  );
  return { ...rest, buckets };
}

const actions = <E extends z.ZodType>(element: E) =>
  z.discriminatedUnion('type', [
    z
      .strictObject({
        type: z.literal('insert'),
        bucket: Bucket,
        element,
        index: Index.optional().describe(
          'Position in the chain; default the end.',
        ),
      })
      .describe('Insert an element into a bucket’s chain.'),
    z
      .strictObject({ type: z.literal('remove'), bucket: Bucket, index: Index })
      .describe('Remove an element from a chain.'),
    z
      .strictObject({
        type: z.literal('set'),
        bucket: Bucket,
        index: Index,
        value: Scalar,
      })
      .describe('Change an element’s value, e.g. update the value for a key.'),
    z
      .strictObject({
        type: z.literal('highlight'),
        bucket: Bucket,
        indices: z.array(Index).max(LIMITS.elementsPerStructure).optional(),
      })
      .describe(
        'Highlight a bucket and, optionally, elements of its chain (this step only), e.g. while probing.',
      ),
    z
      .strictObject({ type: z.literal('settle'), bucket: Bucket, index: Index })
      .describe('Mark an element as found (persists).'),
    z
      .strictObject({ type: z.literal('resetMarks') })
      .describe('Clear every mark.'),
  ]);

export const HashTableAction = actions(Element);
export type HashTableAction = z.infer<typeof HashTableAction>;
export const HashTableActionInput = actions(ElementInput);
export type HashTableActionInput = z.infer<typeof HashTableActionInput>;

export const hashTableSpec: KindSpec<{
  decl: HashTableDecl;
  declInput: HashTableDeclInput;
  action: HashTableAction;
  actionInput: HashTableActionInput;
}> = {
  kind: 'hashTable',
  decl: HashTableDecl,
  declInput: HashTableDeclInput,
  action: HashTableAction,
  actionInput: HashTableActionInput,
  actionTypes: typesOf(HashTableAction),
  normalizeDecl: normalizeHashTableDecl,
  declIds: (decl) =>
    decl.buckets.flatMap((chain, b) =>
      // Reported against the authoring field, `initial`.
      chain.map((e, k): IdRef => ({ id: e.id, path: ['initial', b, k, 'id'] })),
    ),
  validateDecl: (decl): DeclIssue[] => {
    const total = decl.buckets.reduce((n, chain) => n + chain.length, 0);
    return total <= LIMITS.elementsPerStructure
      ? []
      : [
          {
            path: ['initial'],
            message: `The table holds ${total} elements; at most ${LIMITS.elementsPerStructure} are allowed`,
          },
        ];
  },
  normalizeAction: (input, ctx) =>
    input.type === 'insert' && !isElement(input.element)
      ? { ...input, element: { id: ctx.allocateId('e'), value: input.element } }
      : (input as HashTableAction),
  introducedIds: (action) =>
    action.type === 'insert'
      ? [{ id: action.element.id, path: ['element', 'id'] }]
      : [],
};
