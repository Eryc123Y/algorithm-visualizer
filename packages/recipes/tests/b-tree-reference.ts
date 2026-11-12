/**
 * An independent B-tree for the tests of `b-tree` (ADR 0035): mutable
 * nodes, CLRS's one-pass insertion and deletion written straight from the
 * book's description, with the same choices where it leaves one open (in
 * case 3a the left sibling gives first; in case 3b the right sibling is
 * merged when there is one). It knows nothing of the recipe's code.
 */
type K = number | string;

interface RNode {
  keys: K[];
  c: RNode[];
}

const less = (a: K, b: K) =>
  typeof a === 'number' && typeof b === 'number'
    ? a < b
    : String(a) < String(b);

export class RefBTree {
  root: RNode = { keys: [], c: [] };
  readonly t: number;
  constructor(t: number) {
    this.t = t;
  }

  #leaf = (x: RNode) => x.c.length === 0;
  #index = (x: RNode, k: K) => {
    let i = 0;
    while (i < x.keys.length && less(x.keys[i]!, k)) i++;
    return i;
  };

  has(k: K): boolean {
    for (let x = this.root; ;) {
      const i = this.#index(x, k);
      if (i < x.keys.length && x.keys[i] === k) return true;
      if (this.#leaf(x)) return false;
      x = x.c[i]!;
    }
  }

  #split(x: RNode, i: number) {
    const y = x.c[i]!;
    const t = this.t;
    const z: RNode = { keys: y.keys.slice(t), c: y.c.slice(t) };
    x.keys.splice(i, 0, y.keys[t - 1]!);
    x.c.splice(i + 1, 0, z);
    y.keys = y.keys.slice(0, t - 1);
    y.c = y.c.slice(0, t);
  }

  insert(k: K): void {
    if (this.has(k)) return;
    if (this.root.keys.length === 2 * this.t - 1) {
      this.root = { keys: [], c: [this.root] };
      this.#split(this.root, 0);
    }
    let x = this.root;
    while (!this.#leaf(x)) {
      let i = this.#index(x, k);
      if (x.c[i]!.keys.length === 2 * this.t - 1) {
        this.#split(x, i);
        if (less(x.keys[i]!, k)) i++;
      }
      x = x.c[i]!;
    }
    x.keys.splice(this.#index(x, k), 0, k);
  }

  #merge(x: RNode, i: number) {
    const [l, r] = [x.c[i]!, x.c[i + 1]!];
    l.keys.push(x.keys[i]!, ...r.keys);
    l.c.push(...r.c);
    x.keys.splice(i, 1);
    x.c.splice(i + 1, 1);
  }

  #shrink() {
    if (this.root.keys.length === 0 && this.root.c.length === 1)
      this.root = this.root.c[0]!;
  }

  delete(k: K): void {
    this.#delete(this.root, k);
  }

  #delete(start: RNode, k: K): void {
    const t = this.t;
    let x = start;
    for (;;) {
      const i = this.#index(x, k);
      if (i < x.keys.length && x.keys[i] === k) {
        if (this.#leaf(x)) {
          x.keys.splice(i, 1);
          return;
        }
        if (x.c[i]!.keys.length >= t) {
          let p = x.c[i]!;
          while (!this.#leaf(p)) p = p.c.at(-1)!;
          const pred = p.keys.at(-1)!;
          this.#delete(x.c[i]!, pred);
          x.keys[x.keys.indexOf(k)] = pred;
          return;
        }
        if (x.c[i + 1]!.keys.length >= t) {
          let s = x.c[i + 1]!;
          while (!this.#leaf(s)) s = s.c[0]!;
          const succ = s.keys[0]!;
          this.#delete(x.c[i + 1]!, succ);
          x.keys[x.keys.indexOf(k)] = succ;
          return;
        }
        const y = x.c[i]!;
        this.#merge(x, i);
        this.#shrink();
        x = y;
        continue;
      }
      if (this.#leaf(x)) return;
      let c = i;
      if (x.c[i]!.keys.length === t - 1) {
        const left = i > 0 ? x.c[i - 1] : undefined;
        const right = i < x.c.length - 1 ? x.c[i + 1] : undefined;
        if (left !== undefined && left.keys.length >= t) {
          x.c[i]!.keys.unshift(x.keys[i - 1]!);
          x.keys[i - 1] = left.keys.pop()!;
          if (!this.#leaf(left)) x.c[i]!.c.unshift(left.c.pop()!);
        } else if (right !== undefined && right.keys.length >= t) {
          x.c[i]!.keys.push(x.keys[i]!);
          x.keys[i] = right.keys.shift()!;
          if (!this.#leaf(right)) x.c[i]!.c.push(right.c.shift()!);
        } else {
          c = right !== undefined ? i : i - 1;
          const merged = x.c[c]!;
          this.#merge(x, c);
          this.#shrink();
          x = merged;
          continue;
        }
      }
      x = x.c[c]!;
    }
  }

  /** The tree in the notation the module prints. */
  print(x: RNode = this.root): string {
    const keys = `[${x.keys.map(String).join(' ')}]`;
    return this.#leaf(x)
      ? keys
      : `${keys} (${x.c.map((c) => this.print(c)).join(' ')})`;
  }
}
