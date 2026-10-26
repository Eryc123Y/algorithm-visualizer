/**
 * The `tree` kind: rooted trees and forests. Nodes have ordered child
 * slots; a slot may be empty (null), which binary trees use to tell a lone
 * right child from a left one.
 *
 * Covers binary search trees (with rotations and red–black colours),
 * n-ary trees, tries, recursion trees and union–find forests.
 *
 * Marks: `highlight` and `compare` last one step; `visit`, `settle`,
 * `group`, `pointer` and `annotate` persist.
 */
import { z } from 'zod';

import {
  ElementId,
  Group,
  isElement,
  LIMITS,
  PointerName,
  Scalar,
} from '../common.ts';
import { typesOf, type DeclIssue, type IdRef, type KindSpec } from './kind.ts';

const Color = z.enum(['red', 'black']).describe('Red–black tree colour.');

export const TreeNode = z
  .strictObject({
    id: ElementId,
    value: Scalar,
    children: z
      .array(ElementId.nullable())
      .max(LIMITS.elementsPerStructure)
      .optional()
      .describe(
        'Child ids in order; null leaves a slot empty (e.g. no left child).',
      ),
    color: Color.optional(),
  })
  .describe('A tree node.');
export type TreeNode = z.infer<typeof TreeNode>;

const Nodes = z.array(TreeNode).max(LIMITS.elementsPerStructure);

/** Canonical declaration. */
export const TreeDecl = z
  .strictObject({
    kind: z.literal('tree'),
    label: z.string().max(LIMITS.textLength).optional(),
    binary: z
      .boolean()
      .describe(
        'Binary trees have exactly two child slots per node: 0 = left, 1 = right.',
      ),
    nodes: Nodes,
    roots: z.array(ElementId).describe('Root ids, left to right.'),
  })
  .describe('A rooted tree or forest.');
export type TreeDecl = z.infer<typeof TreeDecl>;

export const TreeDeclInput = z
  .strictObject({
    kind: z.literal('tree'),
    label: z.string().max(LIMITS.textLength).optional(),
    binary: z
      .boolean()
      .optional()
      .describe('Default false, or true with `levelOrder`.'),
    nodes: Nodes.optional(),
    roots: z
      .array(ElementId)
      .optional()
      .describe(
        'Root ids; by default every node that is nobody’s child, in order.',
      ),
    levelOrder: z
      .array(Scalar)
      .max(LIMITS.elementsPerStructure)
      .optional()
      .describe(
        'Binary tree in level order as on LeetCode, null for missing nodes, e.g. [3, 9, 20, null, null, 15, 7]. Node ids are e0, e1, … in order. Use instead of `nodes`.',
      ),
  })
  .refine((d) => d.nodes === undefined || d.levelOrder === undefined, {
    message: 'Give either `nodes` or `levelOrder`, not both',
    path: ['levelOrder'],
  })
  .superRefine((d, ctx) => {
    if (d.levelOrder === undefined) return;
    const { consumed } = fromLevelOrder(d.levelOrder);
    const orphan = d.levelOrder.findIndex(
      (v, k) => k >= consumed && v !== null,
    );
    if (orphan >= 0)
      ctx.addIssue({
        code: 'custom',
        path: ['levelOrder', orphan],
        message: `Value ${JSON.stringify(d.levelOrder[orphan])} has no parent: every slot before it is taken or empty`,
      });
  });
export type TreeDeclInput = z.infer<typeof TreeDeclInput>;

/** Builds a binary tree from LeetCode-style level order. */
function fromLevelOrder(values: readonly z.infer<typeof Scalar>[]): {
  nodes: TreeNode[];
  roots: string[];
  /** How many values were placed (or skipped as empty slots). */
  consumed: number;
} {
  const nodes: TreeNode[] = [];
  const first = values[0];
  if (values.length === 0 || first === null || first === undefined)
    return { nodes, roots: [], consumed: Math.min(1, values.length) };
  const queue: { id: string; children: (string | null)[] }[] = [];
  const make = (value: z.infer<typeof Scalar>) => {
    const node = {
      id: `e${nodes.length}`,
      value,
      children: [null, null] as (string | null)[],
    };
    nodes.push(node);
    queue.push(node);
    return node.id;
  };
  make(first);
  let k = 1;
  while (queue.length > 0 && k < values.length) {
    const parent = queue.shift()!;
    for (const slot of [0, 1]) {
      if (k >= values.length) break;
      const value = values[k++]!;
      if (value !== null) parent.children[slot] = make(value);
    }
  }
  return { nodes, roots: ['e0'], consumed: k };
}

function normalizeTreeDecl(input: TreeDeclInput): TreeDecl {
  const {
    levelOrder,
    nodes: given,
    roots: givenRoots,
    binary,
    ...rest
  } = input;
  if (levelOrder !== undefined) {
    const { nodes, roots } = fromLevelOrder(levelOrder);
    return { ...rest, binary: true, nodes, roots };
  }
  const nodes = given ?? [];
  const isBinary = binary ?? false;
  const children = new Set(
    nodes.flatMap((n) => n.children ?? []).filter((c) => c !== null),
  );
  const roots =
    givenRoots ?? nodes.filter((n) => !children.has(n.id)).map((n) => n.id);
  // Binary nodes get both slots; extra children are kept so that
  // validation can report them.
  const normalized = isBinary
    ? nodes.map((n) => ({
        ...n,
        children: [
          n.children?.[0] ?? null,
          n.children?.[1] ?? null,
          ...(n.children?.slice(2) ?? []),
        ],
      }))
    : nodes;
  return { ...rest, binary: isBinary, nodes: normalized, roots };
}

/** Rules a schema cannot express: references exist, one parent each, no cycles. */
export function validateTreeDecl(decl: TreeDecl): DeclIssue[] {
  const issues: DeclIssue[] = [];
  const index = new Map(decl.nodes.map((n, k) => [n.id, k]));
  const parent = new Map<string, string>();
  decl.nodes.forEach((node, k) => {
    const children = node.children ?? [];
    if (decl.binary && children.length > 2)
      issues.push({
        path: ['nodes', k, 'children'],
        message: `Node "${node.id}" has more than two child slots in a binary tree`,
      });
    children.forEach((child, c) => {
      if (child === null) return;
      const path = ['nodes', k, 'children', c];
      if (!index.has(child))
        issues.push({
          path,
          message: `Child "${child}" is not a node of this tree`,
        });
      else if (parent.has(child))
        issues.push({
          path,
          message: `Node "${child}" has two parents ("${parent.get(child)}" and "${node.id}")`,
        });
      else parent.set(child, node.id);
    });
  });
  decl.roots.forEach((root, r) => {
    if (decl.roots.indexOf(root) !== r)
      issues.push({
        path: ['roots', r],
        message: `Root "${root}" is listed twice`,
      });
    else if (!index.has(root))
      issues.push({
        path: ['roots', r],
        message: `Root "${root}" is not a node of this tree`,
      });
    else if (parent.has(root))
      issues.push({
        path: ['roots', r],
        message: `Root "${root}" is also the child of "${parent.get(root)}"`,
      });
  });
  // Every node must be reachable from a root exactly once (no cycles).
  const seen = new Set<string>();
  const stack = [...decl.roots].filter((r) => index.has(r));
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const child of decl.nodes[index.get(id)!]!.children ?? [])
      // Missing children are reported above.
      if (child !== null && index.has(child)) stack.push(child);
  }
  decl.nodes.forEach((node, k) => {
    if (!seen.has(node.id))
      issues.push({
        path: ['nodes', k],
        message: `Node "${node.id}" is not reachable from a root (it is in a cycle or its root is missing)`,
        hint: 'List every root in `roots`, or omit `roots` to use all parentless nodes.',
      });
  });
  return issues;
}

const NodeRef = ElementId.describe('A node id.');
const Slot = z.int().min(0).max(LIMITS.elementsPerStructure);
const SlotInput = z
  .union([Slot, z.enum(['left', 'right'])])
  .describe(
    'A child position; binary trees also accept "left" (0) and "right" (1).',
  );

const actions = <N extends z.ZodType, S extends z.ZodType>(
  newNode: N,
  slotType: S,
) => {
  const slot = { slot: slotType.optional() };
  return z.discriminatedUnion('type', [
    z
      .strictObject({
        type: z.literal('addNode'),
        node: newNode,
        parent: NodeRef.nullable(),
        ...slot,
      })
      .describe(
        'Add a node under `parent` (null makes it a new root). Binary trees: `slot` is "left" or "right" (default the first empty one) and must be empty. Other trees: inserts at `slot`, default appends.',
      ),
    z
      .strictObject({ type: z.literal('removeNode'), node: NodeRef })
      .describe('Remove a node together with its subtree.'),
    z
      .strictObject({
        type: z.literal('setChild'),
        parent: NodeRef,
        child: NodeRef.nullable(),
        ...slot,
      })
      .describe(
        'Move `child` (with its subtree) under `parent`, detaching it from where it was. Binary trees: `slot` is required and any child already there becomes a separate root. Other trees: inserts at `slot`, default appends. With `child: null`, removes the child at `slot` from `parent`; it becomes a separate root.',
      ),
    z
      .strictObject({ type: z.literal('detach'), node: NodeRef })
      .describe(
        'Detach a subtree from its parent so it becomes a separate root.',
      ),
    z
      .strictObject({
        type: z.literal('rotate'),
        node: NodeRef,
        direction: z.enum(['left', 'right']),
      })
      .describe(
        'Binary trees: rotate around `node` (left rotation lifts its right child).',
      ),
    z
      .strictObject({
        type: z.literal('setValue'),
        node: NodeRef,
        value: Scalar,
      })
      .describe('Change a value.'),
    z
      .strictObject({ type: z.literal('swapValues'), a: NodeRef, b: NodeRef })
      .describe('Exchange the values of two nodes (as in heapify on a tree).'),
    z
      .strictObject({
        type: z.literal('setColor'),
        node: NodeRef,
        color: Color.nullable(),
      })
      .describe('Set a red–black colour; null removes it.'),
    z
      .strictObject({
        type: z.literal('highlight'),
        nodes: z.array(NodeRef).min(1).max(LIMITS.elementsPerStructure),
      })
      .describe('Highlight nodes (this step only).'),
    z
      .strictObject({ type: z.literal('compare'), a: NodeRef, b: NodeRef })
      .describe('Mark two nodes as being compared (this step only).'),
    z
      .strictObject({ type: z.literal('visit'), node: NodeRef })
      .describe('Mark a node as visited (persists).'),
    z
      .strictObject({ type: z.literal('settle'), node: NodeRef })
      .describe('Mark a node as final or found (persists).'),
    z
      .strictObject({ type: z.literal('group'), node: NodeRef, group: Group })
      .describe('Put a node in a categorical group 0–5; null removes it.'),
    z
      .strictObject({
        type: z.literal('pointer'),
        name: PointerName,
        node: NodeRef.nullable(),
      })
      .describe(
        'Point a named pointer (e.g. "curr") at a node; null removes it.',
      ),
    z
      .strictObject({
        type: z.literal('annotate'),
        node: NodeRef,
        text: z.string().max(32).nullable(),
      })
      .describe(
        'Show a short note above a node, e.g. its height or balance factor; null removes it.',
      ),
  ]);
};

const NewNode = z.strictObject({
  id: ElementId,
  value: Scalar,
  color: Color.optional(),
});
const NewNodeInput = z
  .union([NewNode, Scalar])
  .describe(
    '`{ "id", "value", "color"? }`, or a bare value to get a generated id.',
  );

export const TreeAction = actions(NewNode, Slot);
export type TreeAction = z.infer<typeof TreeAction>;
export const TreeActionInput = actions(NewNodeInput, SlotInput);
export type TreeActionInput = z.infer<typeof TreeActionInput>;

export const treeSpec: KindSpec<{
  decl: TreeDecl;
  declInput: TreeDeclInput;
  action: TreeAction;
  actionInput: TreeActionInput;
}> = {
  kind: 'tree',
  decl: TreeDecl,
  declInput: TreeDeclInput,
  action: TreeAction,
  actionInput: TreeActionInput,
  actionTypes: typesOf(TreeAction),
  normalizeDecl: normalizeTreeDecl,
  declIds: (decl) =>
    decl.nodes.map((n, k): IdRef => ({ id: n.id, path: ['nodes', k, 'id'] })),
  validateDecl: validateTreeDecl,
  normalizeAction: (input, ctx) => {
    let action: Record<string, unknown> = { ...input };
    if ('slot' in input && typeof input.slot === 'string')
      action = { ...action, slot: input.slot === 'left' ? 0 : 1 };
    if (input.type === 'addNode' && !isElement(input.node))
      action = {
        ...action,
        node: { id: ctx.allocateId('e'), value: input.node },
      };
    return action as TreeAction;
  },
  introducedIds: (action) =>
    action.type === 'addNode'
      ? [{ id: action.node.id, path: ['node', 'id'] }]
      : [],
};
