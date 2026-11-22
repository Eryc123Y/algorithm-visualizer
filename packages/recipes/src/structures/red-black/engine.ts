/**
 * Insertion and deletion in the red–black family (ADR 0034), recorded step
 * by step: the walk down, the new red leaf or the node that moves up, and
 * every case of the two fixups, named after the case, so that a note can
 * show "delete 7 / case-2" whichever side it happens on. An augmented
 * field is kept current and shown as a named note.
 *
 * Pointers: `x` walks down and is RB-DELETE-FIXUP's `x`, which may be NIL
 * (a pointer at an empty slot, ADR 0034); `z` is the inserted node, `y` the
 * successor that moves up, and `w` the sibling in RB-DELETE-FIXUP.
 */
import type { Handle } from '../../recorder.ts';
import type { Listing } from '../../snippet.ts';
import { MAX_SIZE } from '../../structure.ts';
import type { Localized, Text } from '../../text.ts';
import type { Trace } from '../../trace.ts';
import {
  attach,
  colorOf,
  find,
  minimum,
  nodeOf,
  other,
  recompute,
  rotate,
  sideOf,
  transplant,
  withNode,
  type Augment,
  type Color,
  type Keys,
  type RbTree,
  type Side,
} from './model.ts';

export type On = Handle<'tree'>;

/** What one member of the family is: its keys and its field, if any. */
export interface Family<K> {
  readonly keys: Keys<K>;
  readonly aug?: Augment<K>;
}

/** Records a step named `name` at its marker. */
export type Steps = (name: string, narration: Text) => void;

/** The sides in Chinese (ADR 0045). */
const SIDE_ZH = { left: '左', right: '右' } as const;

/**
 * The steps of one listing. A step is at the marker of its name, or, when
 * the listing does not show that code (an augmented tree calls the
 * red–black fixup without repeating it), at the marker `stands` names for
 * it, keeping its own name.
 */
export function stepsOf(
  trace: Trace,
  listing: Listing,
  stands: Readonly<Record<string, string>> = {},
): Steps {
  const has = (marker: string) => listing.code.pseudocode.anchors.has(marker);
  return (name, narration) => {
    const marker = has(name) ? name : stands[name];
    if (marker === undefined || !has(marker))
      throw new Error(`No marker for the step "${name}" in "${listing.name}"`);
    trace.step(marker, narration, marker === name ? {} : { id: name });
  };
}

/** One operation's run: the family, its steps and the tree's handle. */
export interface Run<K> {
  readonly family: Family<K>;
  readonly step: Steps;
  readonly on: On;
}

const POINTERS = ['x', 'y', 'z', 'w'] as const;

/** Removes the pointers an operation leaves behind. */
export function clearPointers(on: On): void {
  for (const name of POINTERS) on.pointer({ name, node: null });
}

/** Shows a node's field, if the family has one. */
export function showField<K>(run: Run<K>, t: RbTree<K>, id: string): void {
  const { aug } = run.family;
  if (aug !== undefined)
    run.on.annotate({
      node: id,
      field: aug.field,
      text: aug.note(nodeOf(t, id).aug),
    });
}

/** Shows every node's field: the first step of each operation does. */
export function showFields<K>(run: Run<K>, t: RbTree<K>): void {
  for (const id of t.nodes.keys()) showField(run, t, id);
}

const name = <K>(run: Run<K>, t: RbTree<K>, id: string) =>
  run.family.keys.text(nodeOf(t, id).key);

function paint<K>(
  run: Run<K>,
  t: RbTree<K>,
  colors: readonly (readonly [string, Color])[],
): RbTree<K> {
  let next = t;
  for (const [id, color] of colors) {
    next = withNode(next, id, { color });
    run.on.setColor({ node: id, color });
  }
  return next;
}

function turn<K>(
  run: Run<K>,
  t: RbTree<K>,
  x: string,
  direction: Side,
): RbTree<K> {
  const up = nodeOf(t, x)[other(direction)]!;
  const next = rotate(t, x, direction, run.family.aug);
  run.on.rotate({ node: x, direction });
  showField(run, next, x);
  showField(run, next, up);
  return next;
}

const fieldChange = <K>(
  aug: Augment<K>,
  before: number,
  after: number,
): Localized =>
  before === after
    ? {
        en: ` Its ${aug.field} stays ${after}.`,
        zh: `它的${aug.fieldZh}保持 ${after}。`,
      }
    : {
        en: ` Its ${aug.field} goes from ${before} to ${after}.`,
        zh: `它的${aug.fieldZh}从 ${before} 变为 ${after}。`,
      };

/**
 * Inserts `key`: walks down, hangs a red leaf, and restores the red–black
 * properties with RB-INSERT-FIXUP. A key the tree holds changes nothing.
 */
export function insert<K>(t: RbTree<K>, key: K, run: Run<K>): RbTree<K> {
  const { keys, aug } = run.family;
  const { on, step } = run;
  const k = keys.text(key);
  const present = find(t, key, keys);
  if (present === null && t.nodes.size >= MAX_SIZE)
    throw new RangeError(`The tree is full: it holds at most ${MAX_SIZE} keys`);
  // An augmented tree checks first, so that it changes no field in vain.
  if (aug !== undefined && present !== null) {
    step('present', {
      en: `${k} is already in the tree, so nothing changes, and no ${aug.field} either.`,
      zh: `${k} 已经在树中，所以什么都不变，${aug.fieldZh}也都不变。`,
    });
    on.pointer({ name: 'x', node: present }).highlight({ nodes: [present] });
    return t;
  }
  let tree = t;
  let parent: string | null = null;
  let side: Side = 'left';
  for (let x = t.root; x !== null;) {
    const n = nodeOf(tree, x);
    const c = keys.compare(key, n.key);
    if (c === 0) {
      step('present', {
        en: `${k} is already in the tree: nothing changes.`,
        zh: `${k} 已经在树中：什么都不变。`,
      });
      on.pointer({ name: 'x', node: x }).highlight({ nodes: [x] });
      return t;
    }
    side = c < 0 ? 'left' : 'right';
    let narration: Localized = {
      en: `${k} ${c < 0 ? '<' : '>'} ${keys.text(n.key)}: go ${side}.`,
      zh: `${k} ${c < 0 ? '<' : '>'} ${keys.text(n.key)}：往${SIDE_ZH[side]}走。`,
    };
    if (aug !== undefined) {
      const field = aug.down(n.aug, key);
      const change = fieldChange(aug, n.aug, field);
      narration = {
        en: narration.en + change.en,
        zh: narration.zh + change.zh,
      };
      tree = withNode(tree, x, { aug: field });
    }
    step('go', narration);
    on.pointer({ name: 'x', node: x }).highlight({ nodes: [x] });
    showField(run, tree, x);
    parent = x;
    x = n[side];
  }
  const z = `n${tree.next}`;
  tree = {
    ...tree,
    next: tree.next + 1,
    nodes: new Map(tree.nodes).set(z, {
      key,
      color: 'red',
      left: null,
      right: null,
      parent,
      aug: 0,
    }),
  };
  tree = recompute(attach(tree, parent, side, z), z, aug);
  step(
    'new',
    parent === null
      ? {
          en: `The tree is empty: ${k} becomes the root, red for now.`,
          zh: `树是空的：${k} 成为根，暂时是红色。`,
        }
      : {
          en: `Hang ${k} as the ${side} child of ${name(run, tree, parent)}, coloured red, so no path gains a black node.`,
          zh: `把 ${k} 挂为 ${name(run, tree, parent)} 的${SIDE_ZH[side]}孩子，涂成红色，这样没有哪条路径多出黑节点。`,
        },
  );
  on.addNode({
    node: { id: z, value: keys.value(key), color: 'red' },
    parent,
    ...(parent === null ? {} : { slot: side }),
  });
  on.pointer({ name: 'x', node: null }).pointer({ name: 'z', node: z });
  showField(run, tree, z);
  return insertFixup(tree, z, run);
}

function insertFixup<K>(t: RbTree<K>, z0: string, run: Run<K>): RbTree<K> {
  const { on, step } = run;
  const say = (id: string | null) =>
    id === null ? 'an empty leaf' : name(run, tree, id);
  const sayZh = (id: string | null) =>
    id === null ? '一片空叶子' : name(run, tree, id);
  let tree = t;
  let z = z0;
  for (;;) {
    const p = nodeOf(tree, z).parent;
    if (p === null || colorOf(tree, p) === 'black') break;
    // A red parent is not the root, so the grandparent exists.
    const g = nodeOf(tree, p).parent!;
    const side = sideOf(tree, p)!;
    const uncle = nodeOf(tree, g)[other(side)];
    if (colorOf(tree, uncle) === 'red') {
      step('case-1', {
        en: `${say(z)} and its parent ${say(p)} are both red, and so is the uncle ${say(uncle)}: make ${say(p)} and ${say(uncle)} black and the grandparent ${say(g)} red, then look again from ${say(g)}.`,
        zh: `${sayZh(z)} 和它的父节点 ${sayZh(p)} 都是红色，叔节点 ${sayZh(uncle)} 也是红色：把 ${sayZh(p)} 和 ${sayZh(uncle)} 涂黑，把祖父节点 ${sayZh(g)} 涂红，再从 ${sayZh(g)} 开始检查。`,
      });
      tree = paint(run, tree, [
        [p, 'black'],
        [uncle!, 'black'],
        [g, 'red'],
      ]);
      on.pointer({ name: 'z', node: g });
      z = g;
      continue;
    }
    if (z === nodeOf(tree, p)[other(side)]) {
      step('case-2', {
        en: `${say(z)} and its parent ${say(p)} are both red and the uncle, ${say(uncle)}, is black, with ${say(z)} on the inside: rotate ${say(p)} ${side}, so that ${say(p)} becomes the lower of the two.`,
        zh: `${sayZh(z)} 和它的父节点 ${sayZh(p)} 都是红色，叔节点 ${sayZh(uncle)} 是黑色，且 ${sayZh(z)} 在内侧：把 ${sayZh(p)} 向${SIDE_ZH[side]}旋转，使 ${sayZh(p)} 成为两者中较低的一个。`,
      });
      tree = turn(run, tree, p, side);
      on.pointer({ name: 'z', node: p });
      z = p;
    }
    const zp = nodeOf(tree, z).parent!;
    const zg = nodeOf(tree, zp).parent!;
    step('case-3', {
      en: `${say(z)} and its parent ${say(zp)} are both red, both ${side} children, and the uncle is black: make ${say(zp)} black and ${say(zg)} red, and rotate ${say(zg)} ${other(side)}.`,
      zh: `${sayZh(z)} 和它的父节点 ${sayZh(zp)} 都是红色，都是${SIDE_ZH[side]}孩子，叔节点是黑色：把 ${sayZh(zp)} 涂黑、${sayZh(zg)} 涂红，再把 ${sayZh(zg)} 向${SIDE_ZH[other(side)]}旋转。`,
    });
    tree = paint(run, tree, [
      [zp, 'black'],
      [zg, 'red'],
    ]);
    tree = turn(run, tree, zg, other(side));
  }
  const root = tree.root!;
  if (colorOf(tree, root) === 'red') {
    step('root', {
      en: `The root ${say(root)} is red: colour it black.`,
      zh: `根 ${sayZh(root)} 是红色：把它涂黑。`,
    });
    tree = paint(run, tree, [[root, 'black']]);
  } else
    // A root z is red, so this is z's black parent ending the loop.
    step('fixed', {
      en: `${say(z)}'s parent is black, so no red node has a red child: the tree is a red–black tree again.`,
      zh: `${sayZh(z)} 的父节点是黑色，所以没有红节点有红孩子：这棵树又是红黑树了。`,
    });
  return tree;
}

/** Where `x` is: a node, or NIL under `parent` on `side`. */
interface At {
  readonly x: string | null;
  readonly parent: string | null;
  readonly side: Side;
}

const pointAt = (on: On, at: At) =>
  on.pointer({
    name: 'x',
    node:
      at.x !== null
        ? at.x
        : at.parent === null
          ? null
          : { parent: at.parent, slot: at.side === 'left' ? 0 : 1 },
  });

/**
 * Deletes `key`, as RB-DELETE does: a node with at most one child gives
 * its place to that child, one with two gives it to its successor; then,
 * if a black node left its place, RB-DELETE-FIXUP restores the black
 * heights. A key the tree does not hold changes nothing.
 */
export function remove<K>(t: RbTree<K>, key: K, run: Run<K>): RbTree<K> {
  const { keys } = run.family;
  const { on, step } = run;
  const k = keys.text(key);
  let z = t.root;
  for (; z !== null;) {
    const n = nodeOf(t, z);
    const c = keys.compare(key, n.key);
    if (c === 0) {
      step('find', { en: `Found ${k}.`, zh: `找到 ${k}。` });
      on.pointer({ name: 'x', node: z }).highlight({ nodes: [z] });
      break;
    }
    const side: Side = c < 0 ? 'left' : 'right';
    step('find', {
      en: `${k} ${c < 0 ? '<' : '>'} ${keys.text(n.key)}: go ${side}.`,
      zh: `${k} ${c < 0 ? '<' : '>'} ${keys.text(n.key)}：往${SIDE_ZH[side]}走。`,
    });
    on.pointer({ name: 'x', node: z }).highlight({ nodes: [z] });
    z = n[side];
  }
  if (z === null) {
    step('missing', {
      en: `${k} is not in the tree: nothing to delete.`,
      zh: `${k} 不在树中：没有要删除的。`,
    });
    on.pointer({ name: 'x', node: null });
    return t;
  }
  const moved = unhook(t, z, run);
  // The successor has moved up: its pointer goes in the next step.
  let pending = true;
  const next: Run<K> = {
    ...run,
    step: (marker, narration) => {
      step(marker, narration);
      if (pending) on.pointer({ name: 'y', node: null });
      pending = false;
    },
  };
  let tree = updateFields(moved.tree, moved.at, next);
  if (moved.lost === 'red') {
    next.step('done', {
      en: `The node that left its place was red, so every path still has as many black nodes: nothing to fix.`,
      zh: `离开原位置的节点是红色的，所以每条路径上的黑节点数都没有变：不需要修复。`,
    });
    return tree;
  }
  tree = deleteFixup(tree, moved.at, next);
  return tree;
}

interface Unhooked<K> {
  readonly tree: RbTree<K>;
  /** Where `x` is: the node that took the removed colour's place. */
  readonly at: At;
  /** The colour that left its place. */
  readonly lost: Color;
}

/** Takes `z` out of the tree, recording the moves. */
function unhook<K>(t: RbTree<K>, z: string, run: Run<K>): Unhooked<K> {
  const { on, step } = run;
  const zn = nodeOf(t, z);
  const k = name(run, t, z);
  const zSide = sideOf(t, z) ?? 'left';
  if (zn.left === null || zn.right === null) {
    const side: Side = zn.left === null ? 'right' : 'left';
    const child = zn[side];
    step(
      zn.left === null ? 'no-left' : 'no-right',
      child === null
        ? {
            en: `${k} has no children: an empty leaf takes its place.`,
            zh: `${k} 没有孩子：由一片空叶子取代它的位置。`,
          }
        : {
            en: `${k} has no ${other(side)} child: its ${side} child ${name(run, t, child)} takes its place.`,
            zh: `${k} 没有${SIDE_ZH[other(side)]}孩子：它的${SIDE_ZH[side]}孩子 ${name(run, t, child)} 取代它的位置。`,
          },
    );
    hookInto(on, zn.parent, zSide, child);
    on.removeNode({ node: z });
    const tree = drop(transplant(t, z, child), z);
    const at = { x: child, parent: zn.parent, side: zSide };
    pointAt(on, at);
    return { tree, at, lost: zn.color };
  }
  const y = minimum(t, zn.right);
  const yn = nodeOf(t, y);
  const yk = name(run, t, y);
  step('successor', {
    en: `${k} has two children, so its successor ${yk}, the least key to its right, will take its place; ${yk} has no left child.`,
    zh: `${k} 有两个孩子，所以由它的后继 ${yk}（它右边最小的关键字）取代它的位置；${yk} 没有左孩子。`,
  });
  on.pointer({ name: 'x', node: null }).pointer({ name: 'y', node: y });
  on.highlight({ nodes: [y] });
  step(
    'move-up',
    yn.parent === z
      ? {
          en: `${yk} takes ${k}'s place, keeping its right subtree and taking ${k}'s left one and its colour.`,
          zh: `${yk} 取代 ${k} 的位置，保留自己的右子树，接过 ${k} 的左子树和颜色。`,
        }
      : {
          en: `${yn.right === null ? 'An empty leaf' : `${yk}'s right child ${name(run, t, yn.right)}`} takes ${yk}'s place; then ${yk} takes ${k}'s place, its two subtrees and its colour.`,
          zh: `${yn.right === null ? '一片空叶子' : `${yk} 的右孩子 ${name(run, t, yn.right)}`}取代 ${yk} 的位置；然后 ${yk} 取代 ${k} 的位置，接过它的两棵子树和颜色。`,
        },
  );
  let tree = t;
  let at: At;
  if (yn.parent === z) at = { x: yn.right, parent: y, side: 'right' };
  else {
    at = { x: yn.right, parent: yn.parent, side: 'left' };
    hookInto(on, yn.parent, 'left', yn.right);
    tree = transplant(tree, y, yn.right);
    on.setChild({ parent: y, child: zn.right, slot: 'right' });
    tree = attach(tree, y, 'right', zn.right);
  }
  if (zn.parent === null) on.detach({ node: y, slot: 0 });
  else on.setChild({ parent: zn.parent, child: y, slot: zSide });
  tree = transplant(tree, z, y);
  on.setChild({ parent: y, child: zn.left, slot: 'left' });
  tree = attach(tree, y, 'left', zn.left);
  tree = withNode(tree, y, { color: zn.color });
  on.setColor({ node: y, color: zn.color });
  on.removeNode({ node: z });
  pointAt(on, at);
  return { tree: drop(tree, z), at, lost: yn.color };
}

/** Records RB-TRANSPLANT's move of `child` (or NIL) to `parent`'s `side`. */
function hookInto(
  on: On,
  parent: string | null,
  side: Side,
  child: string | null,
): void {
  if (parent === null) {
    // The root's place: the child becomes the first root; the old root
    // is removed or moved next.
    if (child !== null) on.detach({ node: child, slot: 0 });
  } else on.setChild({ parent, child, slot: side });
}

const drop = <K>(t: RbTree<K>, id: string): RbTree<K> => {
  const nodes = new Map(t.nodes);
  nodes.delete(id);
  return { ...t, nodes };
};

/**
 * Recomputes the field from where `x` hangs up to the root, the only
 * subtrees that changed, as CLRS walks up after a deletion.
 */
function updateFields<K>(t: RbTree<K>, at: At, run: Run<K>): RbTree<K> {
  const { aug } = run.family;
  const start = at.x !== null ? nodeOf(t, at.x).parent : at.parent;
  if (aug === undefined || start === null) return t;
  let tree = t;
  const path: string[] = [];
  for (
    let id: string | null = start;
    id !== null;
    id = nodeOf(tree, id).parent
  ) {
    tree = recompute(tree, id, aug);
    path.push(id);
  }
  const fields = path
    .map((id) => `${name(run, tree, id)} ${aug.note(nodeOf(tree, id).aug)}`)
    .join(', ');
  run.step('update', {
    en: `Walk up from ${name(run, tree, start)} to the root, recomputing each ${aug.field} on the way: ${fields}.`,
    zh: `从 ${name(run, tree, start)} 往上走到根，沿途重新计算每个节点的${aug.fieldZh}：${fields}。`,
  });
  run.on.highlight({ nodes: path });
  for (const id of path) showField(run, tree, id);
  return tree;
}

function deleteFixup<K>(t: RbTree<K>, start: At, run: Run<K>): RbTree<K> {
  const { on, step } = run;
  let tree = t;
  let at = start;
  const say = (id: string) => name(run, tree, id);
  while (at.x !== tree.root && colorOf(tree, at.x) === 'black') {
    const p = at.x === null ? at.parent! : nodeOf(tree, at.x).parent!;
    const side = at.x === null ? at.side : sideOf(tree, at.x)!;
    const far = other(side);
    const xs =
      at.x === null ? `The empty leaf ${side} of ${say(p)}` : say(at.x);
    const xsZh =
      at.x === null ? `${say(p)} ${SIDE_ZH[side]}边的空叶子` : say(at.x);
    // A doubly black x has a sibling: its other subtree has black height 2.
    let w = nodeOf(tree, p)[far]!;
    if (colorOf(tree, w) === 'red') {
      step('case-1', {
        en: `${xs} carries an extra black, and its sibling ${say(w)} is red: make ${say(w)} black and ${say(p)} red, and rotate ${say(p)} ${side}, so that the sibling is black.`,
        zh: `${xsZh}带着一层额外的黑色，它的兄弟 ${say(w)} 是红色：把 ${say(w)} 涂黑、${say(p)} 涂红，再把 ${say(p)} 向${SIDE_ZH[side]}旋转，使兄弟变成黑色。`,
      });
      on.pointer({ name: 'w', node: w });
      tree = paint(run, tree, [
        [w, 'black'],
        [p, 'red'],
      ]);
      tree = turn(run, tree, p, side);
      w = nodeOf(tree, p)[far]!;
      on.pointer({ name: 'w', node: w });
    }
    const near = nodeOf(tree, w)[side];
    const away = nodeOf(tree, w)[far];
    if (colorOf(tree, near) === 'black' && colorOf(tree, away) === 'black') {
      step('case-2', {
        en: `${xs} carries an extra black, and its sibling ${say(w)} and both its children are black: make ${say(w)} red and pass the extra black up to ${say(p)}.`,
        zh: `${xsZh}带着一层额外的黑色，它的兄弟 ${say(w)} 和兄弟的两个孩子都是黑色：把 ${say(w)} 涂红，把额外的黑色向上传给 ${say(p)}。`,
      });
      on.pointer({ name: 'w', node: w });
      tree = paint(run, tree, [[w, 'red']]);
      at = {
        x: p,
        parent: nodeOf(tree, p).parent,
        side: sideOf(tree, p) ?? 'left',
      };
      pointAt(on, at);
      continue;
    }
    if (colorOf(tree, away) === 'black') {
      step('case-3', {
        en: `The sibling ${say(w)} is black, its ${side} child ${say(near!)} red and its ${far} child black: swap the colours of ${say(w)} and ${say(near!)}, and rotate ${say(w)} ${far}.`,
        zh: `兄弟 ${say(w)} 是黑色，它的${SIDE_ZH[side]}孩子 ${say(near!)} 是红色，${SIDE_ZH[far]}孩子是黑色：交换 ${say(w)} 和 ${say(near!)} 的颜色，再把 ${say(w)} 向${SIDE_ZH[far]}旋转。`,
      });
      on.pointer({ name: 'w', node: w });
      tree = paint(run, tree, [
        [near!, 'black'],
        [w, 'red'],
      ]);
      tree = turn(run, tree, w, far);
      w = nodeOf(tree, p)[far]!;
    }
    const red = nodeOf(tree, w)[far]!;
    step('case-4', {
      en: `The sibling ${say(w)} is black and its ${far} child ${say(red)} is red: give ${say(w)} the colour of ${say(p)}, make ${say(p)} and ${say(red)} black, and rotate ${say(p)} ${side}. The extra black is gone.`,
      zh: `兄弟 ${say(w)} 是黑色，它的${SIDE_ZH[far]}孩子 ${say(red)} 是红色：让 ${say(w)} 取 ${say(p)} 的颜色，把 ${say(p)} 和 ${say(red)} 涂黑，再把 ${say(p)} 向${SIDE_ZH[side]}旋转。额外的黑色消失了。`,
    });
    on.pointer({ name: 'w', node: w });
    tree = paint(run, tree, [
      [w, colorOf(tree, p)],
      [p, 'black'],
      [red, 'black'],
    ]);
    // x and w stay in the last picture, which the narration names; the
    // next operation clears them.
    return turn(run, tree, p, side);
  }
  if (at.x !== null && colorOf(tree, at.x) === 'red') {
    step('x-black', {
      en: `${say(at.x)} is red: colour it black, which puts back the black that left.`,
      zh: `${say(at.x)} 是红色：把它涂黑，补回离开的那层黑色。`,
    });
    tree = paint(run, tree, [[at.x, 'black']]);
    on.pointer({ name: 'w', node: null });
  }
  return tree;
}
