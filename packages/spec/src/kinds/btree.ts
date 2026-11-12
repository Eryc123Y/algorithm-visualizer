/**
 * The `btree` kind (ADR 0035): multiway search trees whose nodes hold
 * several keys in order, such as B-trees and 2-3-4 trees. A node has no
 * children (a leaf) or one more than its keys; child `i` hangs from the
 * gap left of key `i`. Keys are elements: they keep their ids when they
 * move between nodes, so a drawing can follow them.
 *
 * A tree always has a root: an empty tree is a root leaf with no keys, as
 * CLRS's B-TREE-CREATE makes it. The kind enforces no minimum degree, no
 * key order and no level leaves: recipes keep those rules. Every action
 * keeps the shape valid.
 *
 * Marks: `highlight` lasts one step; `settle`, `pointer` and `annotate`
 * persist.
 */
import { z } from 'zod';

import {
  Element,
  ElementId,
  ElementInput,
  isElement,
  LIMITS,
  Place,
  PointerName,
  Scalar,
} from '../common.ts';
import { typesOf, type DeclIssue, type IdRef, type KindSpec } from './kind.ts';

/** Most keys one node holds. */
export const MAX_NODE_KEYS = 32;

const Children = z
  .array(ElementId)
  .max(MAX_NODE_KEYS + 1)
  .describe('Child node ids, one more than the keys; none for a leaf.');

export const BTreeNode = z
  .strictObject({
    id: ElementId,
    keys: z.array(Element).max(MAX_NODE_KEYS),
    children: Children.optional(),
  })
  .describe('A node: its keys in order and its children.');
export type BTreeNode = z.infer<typeof BTreeNode>;

const BTreeNodeInput = z
  .strictObject({
    id: ElementId,
    keys: z
      .array(ElementInput)
      .max(MAX_NODE_KEYS)
      .describe(
        'Keys in order: values like ["G", "M"] (ids "k0", "k1", … are generated through the tree) or elements { "id", "value" }.',
      ),
    children: Children.optional(),
  })
  .describe('A node: its keys in order and its children.');

const label = z.string().max(LIMITS.textLength).optional();

/** Canonical declaration. */
export const BTreeDecl = z
  .strictObject({
    kind: z.literal('btree'),
    label,
    place: Place.optional(),
    nodes: z.array(BTreeNode).min(1).max(LIMITS.elementsPerStructure),
    root: ElementId.describe('The root node.'),
  })
  .describe('A multiway search tree, such as a B-tree.');
export type BTreeDecl = z.infer<typeof BTreeDecl>;

export const BTreeDeclInput = z
  .strictObject({
    kind: z.literal('btree'),
    label,
    place: Place.optional(),
    nodes: z
      .array(BTreeNodeInput)
      .min(1)
      .max(LIMITS.elementsPerStructure)
      .optional()
      .describe('The nodes; by default one empty root with the id "root".'),
    root: ElementId.optional().describe(
      'The root node; by default the node that is nobody’s child.',
    ),
  })
  .describe('A multiway search tree, such as a B-tree.');
export type BTreeDeclInput = z.infer<typeof BTreeDeclInput>;

/** An empty root id, which no element id can be: validation reports it. */
const NO_ROOT = '';

function normalizeBTreeDecl(input: BTreeDeclInput): BTreeDecl {
  const { nodes: given = [{ id: 'root', keys: [] }], root, ...rest } = input;
  // Generated key ids skip the ids the author wrote.
  const taken = new Set([
    ...given.map((n) => n.id),
    ...given.flatMap((n) => n.keys.filter(isElement).map((k) => k.id)),
  ]);
  let next = 0;
  const fresh = (): string => {
    while (taken.has(`k${next}`)) next++;
    return `k${next++}`;
  };
  const nodes = given.map((n): BTreeNode => ({
    id: n.id,
    keys: n.keys.map((k) => (isElement(k) ? k : { id: fresh(), value: k })),
    ...(n.children === undefined ? {} : { children: n.children }),
  }));
  if (root !== undefined) return { ...rest, nodes, root };
  const children = new Set(nodes.flatMap((n) => n.children ?? []));
  const parentless = nodes.filter((n) => !children.has(n.id));
  return {
    ...rest,
    nodes,
    root: parentless.length === 1 ? parentless[0]!.id : NO_ROOT,
  };
}

/** Shape rules: size, child counts, one parent each, one root, no cycles. */
export function validateBTreeDecl(decl: BTreeDecl): DeclIssue[] {
  const issues: DeclIssue[] = [];
  const total = decl.nodes.reduce((n, node) => n + 1 + node.keys.length, 0);
  if (total > LIMITS.elementsPerStructure)
    issues.push({
      path: ['nodes'],
      message: `The tree holds ${total} elements, nodes and keys together; at most ${LIMITS.elementsPerStructure} are allowed`,
    });
  const index = new Map(decl.nodes.map((n, k) => [n.id, k]));
  const parent = new Map<string, string>();
  decl.nodes.forEach((node, k) => {
    const children = node.children ?? [];
    if (children.length !== 0 && children.length !== node.keys.length + 1)
      issues.push({
        path: ['nodes', k, 'children'],
        message: `Node "${node.id}" has ${node.keys.length} keys and ${children.length} children; a node has no children or one more than its keys`,
      });
    children.forEach((child, c) => {
      const path = ['nodes', k, 'children', c];
      if (!index.has(child))
        issues.push({
          path,
          message: `Child "${child}" is not a node of this tree`,
        });
      else if (parent.has(child))
        issues.push({
          path,
          message:
            parent.get(child) === node.id
              ? `Node "${node.id}" lists "${child}" as a child twice`
              : `Node "${child}" has two parents ("${parent.get(child)}" and "${node.id}")`,
        });
      else parent.set(child, node.id);
    });
  });
  if (decl.root === NO_ROOT) {
    issues.push({
      path: ['root'],
      message: 'No node, or more than one, is nobody’s child',
      hint: 'Say which node is the root with `root`.',
    });
    return issues;
  }
  if (!index.has(decl.root)) {
    issues.push({
      path: ['root'],
      message: `Root "${decl.root}" is not a node of this tree`,
    });
    return issues;
  }
  if (parent.has(decl.root))
    issues.push({
      path: ['root'],
      message: `Root "${decl.root}" is also the child of "${parent.get(decl.root)}"`,
    });
  const seen = new Set<string>();
  const stack = [decl.root];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const c of decl.nodes[index.get(id)!]!.children ?? [])
      if (index.has(c)) stack.push(c);
  }
  decl.nodes.forEach((node, k) => {
    if (!seen.has(node.id))
      issues.push({
        path: ['nodes', k],
        message: `Node "${node.id}" is not reachable from the root`,
        hint: 'Every node but the root is the child of one node.',
      });
  });
  return issues;
}

const NodeRef = ElementId.describe('A node id.');
const KeyRef = ElementId.describe('A key id.');
const Index = z.int().min(0).max(MAX_NODE_KEYS);

const actions = <K extends z.ZodType>(key: K) =>
  z.discriminatedUnion('type', [
    z
      .strictObject({
        type: z.literal('insertKey'),
        node: NodeRef,
        index: Index,
        key,
      })
      .describe(
        'Insert a key into a leaf at position `index`, from 0 to its number of keys.',
      ),
    z
      .strictObject({ type: z.literal('removeKey'), key: KeyRef })
      .describe('Remove a key from the leaf that holds it.'),
    z
      .strictObject({ type: z.literal('setKey'), key: KeyRef, value: Scalar })
      .describe(
        'Change a key’s value: a relabelling that keeps its cell and marks.',
      ),
    z
      .strictObject({ type: z.literal('lift'), key: KeyRef, over: KeyRef })
      .describe(
        'The key `key`, in a leaf, leaves it and takes the place of the key `over` in an inner node, which is removed: a predecessor or successor rising in a deletion.',
      ),
    z
      .strictObject({
        type: z.literal('split'),
        node: NodeRef,
        index: Index,
        newNode: ElementId,
      })
      .describe(
        'Split child `index` of `node` around its middle key, at ⌊(k − 1)/2⌋ of its k keys: the middle key rises into `node` at `index`, the keys and children right of it go to the new node `newNode`, child `index + 1`. The child needs at least 3 keys.',
      ),
    z
      .strictObject({ type: z.literal('grow'), newRoot: ElementId })
      .describe(
        'Put a new root with no keys above the root, with the old root as its one child; a split of that child follows.',
      ),
    z
      .strictObject({ type: z.literal('merge'), node: NodeRef, index: Index })
      .describe(
        'Merge child `index` of `node`, its key `index` and child `index + 1` into child `index`; child `index + 1` goes. Both children are leaves, or both have children.',
      ),
    z
      .strictObject({ type: z.literal('shrink') })
      .describe(
        'The root has no keys and one child: the child becomes the root.',
      ),
    z
      .strictObject({
        type: z.literal('borrow'),
        node: NodeRef,
        child: Index,
        from: z.enum(['left', 'right']),
      })
      .describe(
        'Child `child` of `node` takes a key from its sibling on the side `from`, through `node`. From "right": `node`’s key `child` falls to the end of the child, the right sibling’s first key rises in its place, and the sibling’s first child moves to the end of the child. From "left" it mirrors: key `child − 1` falls to the front, the left sibling’s last key rises, its last child moves to the front.',
      ),
    z
      .strictObject({
        type: z.literal('highlight'),
        keys: z.array(KeyRef).max(LIMITS.elementsPerStructure).optional(),
        nodes: z.array(NodeRef).max(LIMITS.elementsPerStructure).optional(),
      })
      .describe('Highlight keys and nodes (this step only).'),
    z
      .strictObject({ type: z.literal('settle'), key: KeyRef })
      .describe('Mark a key as found (persists).'),
    z
      .strictObject({
        type: z.literal('pointer'),
        name: PointerName,
        node: NodeRef.nullable(),
      })
      .describe('Point a named pointer at a node; null removes it.'),
    z
      .strictObject({
        type: z.literal('annotate'),
        node: NodeRef,
        text: z.string().max(32).nullable(),
      })
      .describe('Show a short note beside a node; null removes it.'),
  ]);

export const BTreeAction = actions(Element);
export type BTreeAction = z.infer<typeof BTreeAction>;
export const BTreeActionInput = actions(ElementInput);
export type BTreeActionInput = z.infer<typeof BTreeActionInput>;

export const btreeSpec: KindSpec<{
  decl: BTreeDecl;
  declInput: BTreeDeclInput;
  action: BTreeAction;
  actionInput: BTreeActionInput;
}> = {
  kind: 'btree',
  decl: BTreeDecl,
  declInput: BTreeDeclInput,
  action: BTreeAction,
  actionInput: BTreeActionInput,
  actionTypes: typesOf(BTreeAction),
  normalizeDecl: normalizeBTreeDecl,
  declIds: (decl) =>
    decl.nodes.flatMap((n, k): IdRef[] => [
      { id: n.id, path: ['nodes', k, 'id'] },
      ...n.keys.map((key, j): IdRef => ({
        id: key.id,
        path: ['nodes', k, 'keys', j, 'id'],
      })),
    ]),
  validateDecl: validateBTreeDecl,
  normalizeAction: (input, ctx) =>
    input.type === 'insertKey' && !isElement(input.key)
      ? { ...input, key: { id: ctx.allocateId('k'), value: input.key } }
      : (input as BTreeAction),
  introducedIds: (action) =>
    action.type === 'insertKey'
      ? [{ id: action.key.id, path: ['key', 'id'] }]
      : action.type === 'split'
        ? [{ id: action.newNode, path: ['newNode'] }]
        : action.type === 'grow'
          ? [{ id: action.newRoot, path: ['newRoot'] }]
          : [],
};
