/**
 * The graph notation (ADR 0032): an edge list such as `A-B 4, B-C 2, D`.
 *
 * - Items are separated by commas or line breaks; empty items are skipped.
 * - An item is an edge, `from-to` (undirected) or `from->to` (directed),
 *   with an optional weight after a space, or a node name alone.
 * - A graph is directed or not, so its edges all use `-` or all `->`.
 * - Names are 1 to 24 letters, digits and `_`. Nodes come in the order
 *   they first appear, edges in the order given.
 */
import { NotationError, quoted } from './error.ts';
import { formatNumber, numberAt } from './list.ts';

export interface NotatedGraph {
  readonly nodes: string[];
  readonly edges: ([string, string] | [string, string, number])[];
  /** Present, and true, when the edges are directed. */
  readonly directed?: true;
}

export interface GraphLimits {
  readonly maxNodes: number;
  readonly maxEdges: number;
  /** Largest weight either way. */
  readonly maxWeight: number;
}

/** A node name of the notation. */
export const NOTATION_NAME = /^[A-Za-z0-9_]{1,24}$/;
const NAME_CHAR = /[A-Za-z0-9_]/;
const MAX_NAME = 24;
/** Spaces within an item: anything but a line break. */
const INLINE_SPACE = /[^\S\n\r]/;
const ITEM_END = /[,\n\r]/;

/** Reads a graph; throws a `NotationError`. */
export function parseGraph(text: string, limits: GraphLimits): NotatedGraph {
  return new GraphReader(text, limits).read();
}

class GraphReader {
  #i = 0;
  readonly #nodes: string[] = [];
  readonly #seen = new Set<string>();
  readonly #edges: NotatedGraph['edges'] = [];
  /** The first edge's arrow and the text of that edge. */
  #arrow: { readonly directed: boolean; readonly edge: string } | undefined;

  readonly text: string;
  readonly limits: GraphLimits;

  constructor(text: string, limits: GraphLimits) {
    this.text = text;
    this.limits = limits;
  }

  read(): NotatedGraph {
    const { text } = this;
    for (;;) {
      while (this.#i < text.length && /[\s,]/.test(text[this.#i]!)) this.#i++;
      if (this.#i >= text.length) break;
      this.#item();
    }
    return this.#arrow?.directed
      ? { nodes: this.#nodes, edges: this.#edges, directed: true }
      : { nodes: this.#nodes, edges: this.#edges };
  }

  #item(): void {
    const from = this.#name('a node name');
    this.#spaces();
    const arrowAt = this.#i;
    const arrow = this.text.startsWith('->', arrowAt)
      ? '->'
      : this.text[arrowAt] === '-'
        ? '-'
        : undefined;
    if (arrow === undefined) {
      this.#end(`"-", "->" or "," after ${quoted(from)}`);
      this.#node(from);
      return;
    }
    this.#i += arrow.length;
    this.#spaces();
    const to = this.#name(`a node name after ${quoted(from + arrow)}`);
    const edge = `${from}${arrow}${to}`;
    this.#direction(arrow === '->', edge, arrowAt);
    const spaced = this.#spaces();
    let weight: number | undefined;
    if (!this.#atItemEnd()) {
      const at = this.#i;
      const token = this.#token();
      // "A-B-3" is no weight: a weight comes after a space.
      if (!spaced)
        throw new NotationError(
          `Expected "," or a space and a weight after ${quoted(edge)}, not ${quoted(token)}`,
          at,
        );
      weight = numberAt(token, at, `a weight or "," after ${quoted(edge)}`);
      if (Math.abs(weight) > this.limits.maxWeight)
        throw new NotationError(
          `The weight ${quoted(token)} is beyond ${this.limits.maxWeight} either way`,
          at,
        );
      this.#spaces();
      this.#end(`"," after ${quoted(`${edge} ${token}`)}`);
    }
    this.#node(from);
    this.#node(to);
    if (this.#edges.length >= this.limits.maxEdges)
      throw new NotationError(
        `A graph has at most ${this.limits.maxEdges} edges; ${quoted(edge)} is one more`,
        arrowAt,
      );
    this.#edges.push(weight === undefined ? [from, to] : [from, to, weight]);
  }

  /** Reads a name, or throws saying `expected`. */
  #name(expected: string): string {
    const start = this.#i;
    while (this.#i < this.text.length && NAME_CHAR.test(this.text[this.#i]!))
      this.#i++;
    const name = this.text.slice(start, this.#i);
    if (name === '') {
      const rest = this.#atItemEnd() ? '' : this.#token();
      this.#i = start;
      throw new NotationError(
        rest === ''
          ? `Expected ${expected}`
          : `Expected ${expected}, not ${quoted(rest)}`,
        start,
      );
    }
    if (name.length > MAX_NAME)
      throw new NotationError(
        `The name ${quoted(name)} is longer than ${MAX_NAME} characters`,
        start,
      );
    return name;
  }

  #direction(directed: boolean, edge: string, at: number): void {
    if (this.#arrow === undefined) {
      this.#arrow = { directed, edge };
      return;
    }
    if (this.#arrow.directed === directed) return;
    const [first, other] = directed
      ? ['undirected', 'directed']
      : ['directed', 'undirected'];
    throw new NotationError(
      `The edge ${quoted(edge)} is ${other}, but ${quoted(this.#arrow.edge)} is ${first}; write every edge with "-" or every edge with "->"`,
      at,
    );
  }

  #node(name: string): void {
    if (this.#seen.has(name)) return;
    if (this.#nodes.length >= this.limits.maxNodes)
      throw new NotationError(
        `A graph has at most ${this.limits.maxNodes} nodes; ${quoted(name)} is one more`,
        this.text.lastIndexOf(name, this.#i),
      );
    this.#seen.add(name);
    this.#nodes.push(name);
  }

  /** Skips spaces within the item; says whether there were any. */
  #spaces(): boolean {
    const start = this.#i;
    while (this.#i < this.text.length && INLINE_SPACE.test(this.text[this.#i]!))
      this.#i++;
    return this.#i > start;
  }

  #atItemEnd(): boolean {
    return this.#i >= this.text.length || ITEM_END.test(this.text[this.#i]!);
  }

  /** Throws unless the item ends here. */
  #end(expected: string): void {
    if (this.#atItemEnd()) return;
    const at = this.#i;
    throw new NotationError(
      `Expected ${expected}, not ${quoted(this.#token())}`,
      at,
    );
  }

  /** Reads up to the next space, comma or line break. */
  #token(): string {
    const start = this.#i;
    while (this.#i < this.text.length && !/[\s,]/.test(this.text[this.#i]!))
      this.#i++;
    return this.text.slice(start, this.#i);
  }
}

/** A graph in its structured form. */
export interface StructuredGraph {
  readonly nodes: readonly string[];
  readonly edges: readonly (readonly [string, string, number?])[];
  readonly directed?: boolean;
}

/**
 * The notation of `g`, or undefined if it has none: a name the notation
 * cannot write, a node listed twice, or a directed graph without edges.
 */
export function printGraph(g: StructuredGraph): string | undefined {
  const { nodes, edges } = g;
  if (nodes.some((v) => !NOTATION_NAME.test(v))) return undefined;
  if (new Set(nodes).size !== nodes.length) return undefined;
  if (g.directed && edges.length === 0) return undefined;
  const names = new Set(nodes);
  if (edges.some(([from, to]) => !names.has(from) || !names.has(to)))
    return undefined;
  const arrow = g.directed ? '->' : '-';
  const items: string[] = [];
  const seen = new Set<string>();
  /** The first `count` nodes, in node order, not written yet. */
  const upcoming = (count: number) =>
    nodes.filter((v) => !seen.has(v)).slice(0, count);
  for (const [from, to, weight] of edges) {
    // An edge writes its new ends in order, which keeps the node order
    // only if they are the next nodes; until they are, write the next
    // node alone.
    let fresh = [...new Set([from, to])].filter((v) => !seen.has(v));
    while (upcoming(fresh.length).some((v, k) => v !== fresh[k])) {
      const v = upcoming(1)[0]!;
      seen.add(v);
      items.push(v);
      fresh = fresh.filter((w) => w !== v);
    }
    for (const v of fresh) seen.add(v);
    const shown = weight === undefined ? '' : ` ${formatNumber(weight)}`;
    items.push(`${from}${arrow}${to}${shown}`);
  }
  items.push(...upcoming(nodes.length));
  return items.join(', ');
}
