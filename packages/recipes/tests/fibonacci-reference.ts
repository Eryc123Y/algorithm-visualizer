/**
 * An independent Fibonacci heap for the tests of `fibonacci-heap` (ADR
 * 0034): mutable nodes, with the root list and each child list as plain
 * arrays in drawn order. It follows CLRS's procedures and the placement
 * rules of ADR 0034 (a new root or a cut goes just left of `min`, an
 * extracted minimum's children take its place, CONSOLIDATE rebuilds the
 * root list in the order of A), and knows nothing of the recipe's code.
 */
interface RNode {
  key: number;
  mark: boolean;
  parent: RNode | null;
  children: RNode[];
}

export class RefFibHeap {
  roots: RNode[] = [];
  min: RNode | null = null;

  static parse(text: string): RefFibHeap {
    const h = new RefFibHeap();
    let at = 0;
    const skip = () => {
      while (at < text.length && /[\s,]/.test(text[at]!)) at++;
    };
    const forest = (parent: RNode | null): RNode[] => {
      const out: RNode[] = [];
      for (skip(); at < text.length && text[at] !== ')'; skip()) {
        const m = /^-?\d+(\.\d+)?/.exec(text.slice(at))!;
        at += m[0].length;
        const node: RNode = {
          key: Number(m[0]),
          mark: false,
          parent,
          children: [],
        };
        if (text[at] === '*') {
          node.mark = true;
          at++;
        }
        if (text[at] === '(') {
          at++;
          node.children = forest(node);
          at++;
        }
        out.push(node);
      }
      return out;
    };
    h.roots = forest(null);
    h.min = h.roots.reduce<RNode | null>(
      (m, r) => (m === null || r.key < m.key ? r : m),
      null,
    );
    return h;
  }

  get size(): number {
    const count = (n: RNode): number =>
      1 + n.children.reduce((s, c) => s + count(c), 0);
    return this.roots.reduce((s, r) => s + count(r), 0);
  }

  print(): string {
    const show = (n: RNode): string =>
      `${n.key === -Infinity ? '−∞' : n.key}${n.mark ? '*' : ''}${
        n.children.length === 0 ? '' : `(${n.children.map(show).join(' ')})`
      }`;
    return this.roots.map(show).join(' ');
  }

  #leftOfMin(x: RNode): void {
    this.roots.splice(this.roots.indexOf(this.min!), 0, x);
  }

  insert(key: number): void {
    const x: RNode = { key, mark: false, parent: null, children: [] };
    if (this.min === null) {
      this.roots = [x];
      this.min = x;
      return;
    }
    this.#leftOfMin(x);
    if (key < this.min.key) this.min = x;
  }

  union(other: RefFibHeap): void {
    this.roots.push(...other.roots);
    if (
      this.min === null ||
      (other.min !== null && other.min.key < this.min.key)
    )
      this.min = other.min;
  }

  extractMin(): number {
    const z = this.min!;
    const at = this.roots.indexOf(z);
    for (const c of z.children) c.parent = null;
    this.roots.splice(at, 0, ...z.children);
    z.children = [];
    const k = this.roots.indexOf(z);
    const right = this.roots[(k + 1) % this.roots.length]!;
    this.roots.splice(k, 1);
    if (this.roots.length === 0) {
      this.min = null;
      return z.key;
    }
    this.min = right;
    this.#consolidate();
    return z.key;
  }

  #consolidate(): void {
    const n = this.size;
    const phi = (1 + Math.sqrt(5)) / 2;
    const D = n <= 1 ? 0 : Math.floor(Math.log(n) / Math.log(phi) + 1e-9);
    const A: (RNode | null)[] = Array.from({ length: D + 1 }, () => null);
    // Once round the circular list, from min.
    const from = this.roots.indexOf(this.min!);
    const round = [...this.roots.slice(from), ...this.roots.slice(0, from)];
    for (const w of round) {
      let x = w;
      let d = x.children.length;
      while (A[d] !== null) {
        let y = A[d]!;
        if (x.key > y.key) [x, y] = [y, x];
        this.roots.splice(this.roots.indexOf(y), 1);
        x.children.push(y);
        y.parent = x;
        y.mark = false;
        A[d] = null;
        d++;
      }
      A[d] = x;
    }
    this.roots = A.filter((r): r is RNode => r !== null);
    this.min = this.roots.reduce((m, r) => (r.key < m.key ? r : m));
  }

  #find(key: number): RNode {
    const search = (ns: RNode[]): RNode | undefined => {
      for (const n of ns) {
        if (n.key === key) return n;
        const below = search(n.children);
        if (below !== undefined) return below;
      }
      return undefined;
    };
    return search(this.roots)!;
  }

  #cut(x: RNode, y: RNode): void {
    y.children.splice(y.children.indexOf(x), 1);
    this.#leftOfMin(x);
    x.parent = null;
    x.mark = false;
  }

  decreaseKey(key: number, to: number): void {
    const x = this.#find(key);
    x.key = to;
    const y = x.parent;
    if (y !== null && x.key < y.key) {
      this.#cut(x, y);
      for (let c = y; c.parent !== null;) {
        const z = c.parent;
        if (!c.mark) {
          c.mark = true;
          break;
        }
        this.#cut(c, z);
        c = z;
      }
    }
    if (x.key < this.min!.key) this.min = x;
  }

  delete(key: number): void {
    this.decreaseKey(key, -Infinity);
    this.extractMin();
  }

  /** Every key, for checking what extract-min returns. */
  keys(): number[] {
    const out: number[] = [];
    const walk = (n: RNode) => {
      out.push(n.key);
      n.children.forEach(walk);
    };
    this.roots.forEach(walk);
    return out;
  }
}
