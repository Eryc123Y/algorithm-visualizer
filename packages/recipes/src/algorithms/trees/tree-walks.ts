/**
 * The three depth-first walks of a binary tree (ADR 0023): inorder,
 * preorder and postorder, each a module of its own with its own code. A
 * tree is given in level order, with null for gaps, and each walk writes
 * the keys it visits into an output array, with the call stack beside
 * the tree (ADR 0029).
 */
import { z } from 'zod';

import type { Text } from '../../text.ts';
import { defineAlgorithm, type Algorithm } from '../../algorithm.ts';
import { callStack } from '../../call-stack.ts';
import { listField } from '../../notation/schema.ts';

/** Most entries of a level order, so the tree fits on one screen. */
export const MAX_LEVEL_ORDER = 31;

const TreeInput = z.strictObject({
  levelOrder: listField(
    z
      .array(z.number().nullable())
      .min(1)
      .max(MAX_LEVEL_ORDER)
      .describe(
        'The tree in level order, null for gaps, e.g. [4, 2, 6, 1, 3, null, 7].',
      ),
    'level',
  ),
});
type TreeInput = z.output<typeof TreeInput>;

/** The shape the protocol derives from a level order: node k is e<k>. */
function shape(levelOrder: readonly (number | null)[]) {
  if (levelOrder[0] === null)
    throw new RangeError('The tree is empty: its root is null');
  const values = levelOrder.filter((v) => v !== null);
  const children: [number | null, number | null][] = [[null, null]];
  const queue = [0];
  let k = 1;
  while (queue.length > 0 && k < levelOrder.length) {
    const parent = queue.shift()!;
    for (const side of [0, 1] as const) {
      if (k >= levelOrder.length) break;
      if (levelOrder[k++] === null) continue;
      children.push([null, null]);
      children[parent]![side] = children.length - 1;
      queue.push(children.length - 1);
    }
  }
  if (k < levelOrder.length && levelOrder.slice(k).some((v) => v !== null))
    throw new RangeError(
      'The level order has a value with no parent: every slot before it is taken or empty',
    );
  return { values, children };
}

type Order = 'inorder' | 'preorder' | 'postorder';

/** Where the visit comes among the two recursive calls. */
const BODY: Readonly<Record<Order, readonly ('left' | 'visit' | 'right')[]>> = {
  inorder: ['left', 'visit', 'right'],
  preorder: ['visit', 'left', 'right'],
  postorder: ['left', 'right', 'visit'],
};

/** The walk's code: a test for NIL, then the body in the order's sequence. */
function code(order: Order) {
  const name = `${order.toUpperCase()}-TREE-WALK`;
  const body = (call: (side: string) => string, visit: string) =>
    BODY[order].map(
      (part) => `        ${part === 'visit' ? visit : call(part)}`,
    );
  return {
    pseudocode: [
      `${name}(x)`,
      '    if x ≠ NIL  // @enter',
      ...body((side) => `${name}(x.${side})`, 'print x.key  // @visit'),
    ].join('\n'),
    python: [
      `def ${order}(x):`,
      '    if x is not None:  # @enter',
      ...body((side) => `${order}(x.${side})`, 'print(x.key)  # @visit'),
    ].join('\n'),
  };
}

const DESCRIPTION: Readonly<Record<Order, Text>> = {
  inorder: {
    en: 'Walks a binary tree visiting each node between its left and right subtrees, which lists a search tree in sorted order.',
    zh: '遍历二叉树，在左右子树之间访问每个节点，这样会按从小到大的顺序列出二叉搜索树的关键字。',
  },
  preorder: {
    en: 'Walks a binary tree visiting each node before its subtrees, left then right.',
    zh: '遍历二叉树，先访问每个节点，再依次遍历它的左子树和右子树。',
  },
  postorder: {
    en: 'Walks a binary tree visiting each node after its subtrees, left then right.',
    zh: '遍历二叉树，先依次遍历每个节点的左子树和右子树，再访问它。',
  },
};

/** Each order's name in Chinese. */
const ORDER_ZH: Readonly<Record<Order, string>> = {
  inorder: '中序',
  preorder: '先序',
  postorder: '后序',
};

function treeWalk(order: Order): Algorithm<TreeInput> {
  const title = {
    en: `${order[0]!.toUpperCase()}${order.slice(1)} tree walk`,
    zh: `${ORDER_ZH[order]}遍历`,
  };
  return defineAlgorithm({
    id: `${order}-tree-walk`,
    title,
    topic: 'trees',
    summary: DESCRIPTION[order],
    input: TreeInput,
    main: 'levelOrder',
    examples: [{ levelOrder: [4, 2, 6, 1, 3, null, 7] }],
    code: code(order),
    run({ levelOrder }, outer) {
      const { values, children } = shape(levelOrder);
      const tree = outer.add(
        'tree',
        {
          kind: 'tree',
          levelOrder: [...levelOrder],
        },
        { heading: { en: 'tree', zh: '树' } },
      );
      const out = outer.add(
        'out',
        {
          kind: 'array',
          initial: [],
        },
        { heading: { en: 'out', zh: '输出' } },
      );
      // A call on a node is on the stack from its enter step until the
      // next step after it returns (ADR 0029).
      const calls = callStack(outer);
      const { trace } = calls;
      let written = 0;
      const walk = (n: number | null): void => {
        if (n === null) return;
        const id = `e${n}`;
        trace.step('enter', {
          en: `Enter ${values[n]}.`,
          zh: `进入 ${values[n]}。`,
        });
        calls.push(`call-${id}`, `walk ${values[n]}`);
        tree.pointer({ name: 'x', node: id });
        for (const part of BODY[order]) {
          if (part !== 'visit') {
            walk(children[n]![part === 'left' ? 0 : 1]);
            continue;
          }
          trace.step('visit', {
            en: `Visit ${values[n]}: it is number ${written + 1} of the ${order} order.`,
            zh: `访问 ${values[n]}：它是${ORDER_ZH[order]}序列中的第 ${written + 1} 个。`,
          });
          tree.pointer({ name: 'x', node: id }).visit({ node: id });
          out.insert({
            index: written++,
            element: { id: `o${n}`, value: values[n]! },
          });
        }
        calls.leave();
      };
      walk(0);
      tree.pointer({ name: 'x', node: null });
      calls.close();
    },
  });
}

export const inorderTreeWalk = treeWalk('inorder');
export const preorderTreeWalk = treeWalk('preorder');
export const postorderTreeWalk = treeWalk('postorder');
