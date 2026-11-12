/**
 * An independent red–black tree for the tests of the red–black family
 * (ADR 0034): mutable nodes and one shared black sentinel, written the
 * textbook way, with both sides of each fixup spelled out. It knows
 * nothing of the recipes' model or engine. `shape` gives a tree as nested
 * [key, colour, left, right] for comparing with what a document draws.
 */
import type { TreeState } from '@algoviz/core';

interface RNode<K> {
  key: K;
  red: boolean;
  left: RNode<K>;
  right: RNode<K>;
  p: RNode<K>;
}

export type Shape =
  [unknown, 'red' | 'black', Shape | null, Shape | null] | null;

export class RefTree<K> {
  readonly nil: RNode<K>;
  root: RNode<K>;
  readonly #less: (a: K, b: K) => boolean;

  constructor(less: (a: K, b: K) => boolean) {
    const nil = { red: false } as RNode<K>;
    nil.left = nil.right = nil.p = nil;
    this.nil = nil;
    this.root = nil;
    this.#less = less;
  }

  #equal(a: K, b: K) {
    return !this.#less(a, b) && !this.#less(b, a);
  }

  find(key: K): RNode<K> {
    let x = this.root;
    while (x !== this.nil && !this.#equal(key, x.key))
      x = this.#less(key, x.key) ? x.left : x.right;
    return x;
  }

  has(key: K): boolean {
    return this.find(key) !== this.nil;
  }

  #leftRotate(x: RNode<K>) {
    const y = x.right;
    x.right = y.left;
    if (y.left !== this.nil) y.left.p = x;
    y.p = x.p;
    if (x.p === this.nil) this.root = y;
    else if (x === x.p.left) x.p.left = y;
    else x.p.right = y;
    y.left = x;
    x.p = y;
  }

  #rightRotate(x: RNode<K>) {
    const y = x.left;
    x.left = y.right;
    if (y.right !== this.nil) y.right.p = x;
    y.p = x.p;
    if (x.p === this.nil) this.root = y;
    else if (x === x.p.right) x.p.right = y;
    else x.p.left = y;
    y.right = x;
    x.p = y;
  }

  insert(key: K): void {
    if (this.has(key)) return;
    const z: RNode<K> = {
      key,
      red: true,
      left: this.nil,
      right: this.nil,
      p: this.nil,
    };
    let y = this.nil;
    let x = this.root;
    while (x !== this.nil) {
      y = x;
      x = this.#less(z.key, x.key) ? x.left : x.right;
    }
    z.p = y;
    if (y === this.nil) this.root = z;
    else if (this.#less(z.key, y.key)) y.left = z;
    else y.right = z;
    this.#insertFixup(z);
  }

  #insertFixup(start: RNode<K>) {
    let z = start;
    while (z.p.red) {
      if (z.p === z.p.p.left) {
        const y = z.p.p.right;
        if (y.red) {
          z.p.red = false;
          y.red = false;
          z.p.p.red = true;
          z = z.p.p;
        } else {
          if (z === z.p.right) {
            z = z.p;
            this.#leftRotate(z);
          }
          z.p.red = false;
          z.p.p.red = true;
          this.#rightRotate(z.p.p);
        }
      } else {
        const y = z.p.p.left;
        if (y.red) {
          z.p.red = false;
          y.red = false;
          z.p.p.red = true;
          z = z.p.p;
        } else {
          if (z === z.p.left) {
            z = z.p;
            this.#rightRotate(z);
          }
          z.p.red = false;
          z.p.p.red = true;
          this.#leftRotate(z.p.p);
        }
      }
    }
    this.root.red = false;
  }

  #transplant(u: RNode<K>, v: RNode<K>) {
    if (u.p === this.nil) this.root = v;
    else if (u === u.p.left) u.p.left = v;
    else u.p.right = v;
    v.p = u.p;
  }

  delete(key: K): void {
    const z = this.find(key);
    if (z === this.nil) return;
    let y = z;
    let lostRed = y.red;
    let x: RNode<K>;
    if (z.left === this.nil) {
      x = z.right;
      this.#transplant(z, z.right);
    } else if (z.right === this.nil) {
      x = z.left;
      this.#transplant(z, z.left);
    } else {
      y = z.right;
      while (y.left !== this.nil) y = y.left;
      lostRed = y.red;
      x = y.right;
      if (y.p === z) x.p = y;
      else {
        this.#transplant(y, y.right);
        y.right = z.right;
        y.right.p = y;
      }
      this.#transplant(z, y);
      y.left = z.left;
      y.left.p = y;
      y.red = z.red;
    }
    if (!lostRed) this.#deleteFixup(x);
    this.nil.p = this.nil;
  }

  #deleteFixup(start: RNode<K>) {
    let x = start;
    while (x !== this.root && !x.red) {
      if (x === x.p.left) {
        let w = x.p.right;
        if (w.red) {
          w.red = false;
          x.p.red = true;
          this.#leftRotate(x.p);
          w = x.p.right;
        }
        if (!w.left.red && !w.right.red) {
          w.red = true;
          x = x.p;
        } else {
          if (!w.right.red) {
            w.left.red = false;
            w.red = true;
            this.#rightRotate(w);
            w = x.p.right;
          }
          w.red = x.p.red;
          x.p.red = false;
          w.right.red = false;
          this.#leftRotate(x.p);
          x = this.root;
        }
      } else {
        let w = x.p.left;
        if (w.red) {
          w.red = false;
          x.p.red = true;
          this.#rightRotate(x.p);
          w = x.p.left;
        }
        if (!w.right.red && !w.left.red) {
          w.red = true;
          x = x.p;
        } else {
          if (!w.left.red) {
            w.right.red = false;
            w.red = true;
            this.#leftRotate(w);
            w = x.p.left;
          }
          w.red = x.p.red;
          x.p.red = false;
          w.left.red = false;
          this.#rightRotate(x.p);
          x = this.root;
        }
      }
    }
    x.red = false;
  }

  /** The keys in order. */
  keys(): K[] {
    const out: K[] = [];
    const walk = (x: RNode<K>) => {
      if (x === this.nil) return;
      walk(x.left);
      out.push(x.key);
      walk(x.right);
    };
    walk(this.root);
    return out;
  }

  /** The tree as nested [value, colour, left, right], keys shown by `show`. */
  shape(show: (key: K) => unknown = (k) => k): Shape {
    const of = (x: RNode<K>): Shape =>
      x === this.nil
        ? null
        : [show(x.key), x.red ? 'red' : 'black', of(x.left), of(x.right)];
    return of(this.root);
  }
}

/** A drawn tree as nested [value, colour, left, right]. */
export function drawnShape(tree: TreeState): Shape {
  const byId = new Map(tree.data.nodes.map((n) => [n.id, n]));
  const of = (id: string | null): Shape => {
    if (id === null) return null;
    const n = byId.get(id)!;
    return [
      n.value,
      n.color ?? 'black',
      of(n.children[0] ?? null),
      of(n.children[1] ?? null),
    ];
  };
  return of(tree.data.roots[0] ?? null);
}

/**
 * Problems with a drawn tree as a red–black tree: one root, keys in order,
 * a black root, no red node with a red child, equal black heights.
 */
export function redBlackProblems(
  tree: TreeState,
  less: (a: unknown, b: unknown) => boolean,
): string[] {
  const problems: string[] = [];
  if (tree.data.roots.length > 1) problems.push('more than one root');
  const byId = new Map(tree.data.nodes.map((n) => [n.id, n]));
  const order: unknown[] = [];
  const height = (id: string | null): number => {
    if (id === null) return 1;
    const n = byId.get(id)!;
    const [l, r] = [n.children[0] ?? null, n.children[1] ?? null];
    const hl = height(l);
    order.push(n.value);
    const hr = height(r);
    if (n.color === 'red')
      for (const c of [l, r])
        if (c !== null && byId.get(c)!.color === 'red')
          problems.push(`red ${String(n.value)} has a red child`);
    if (hl !== hr)
      problems.push(`black heights differ under ${String(n.value)}`);
    return hl + (n.color === 'red' ? 0 : 1);
  };
  const root = tree.data.roots[0] ?? null;
  if (root !== null && byId.get(root)!.color === 'red')
    problems.push('the root is red');
  height(root);
  for (let k = 1; k < order.length; k++)
    if (!less(order[k - 1], order[k])) problems.push('keys out of order');
  return problems;
}
