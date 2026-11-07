/**
 * Binary heap operations (ADR 0018): push, pop, and decrease-key (or, on a
 * max-heap, increase-key), each from a heap given as values to push or as
 * an array that already is a heap. The heap is an array shown as a tree,
 * as in `binaryHeap`. The code is in pseudocode and Python (ADR 0017),
 * both with indices from 0.
 */
import { checkFinite, checkInteger, checkLength } from '../check.ts';
import {
  checkOp,
  MAX_SIZE,
  runOps,
  type Applied,
  type OpRun,
  type StructureDef,
} from './run.ts';
import { listing, type Listing } from './snippet.ts';
import { silentTape, type Tape } from './tape.ts';

export type HeapOrder = 'min' | 'max';

export type HeapCall =
  | { readonly op: 'push'; readonly value: number }
  | { readonly op: 'pop' }
  | {
      readonly op: 'decreaseKey' | 'increaseKey';
      readonly index: number;
      readonly value: number;
    };

/** Values to push one by one, or an array that already is a heap. */
export type HeapFrom =
  readonly number[] | { readonly array: readonly number[] };

interface Item {
  readonly id: string;
  readonly value: number;
}

export interface HeapState {
  readonly items: readonly Item[];
  /** Number for the next element id. */
  readonly next: number;
}

type T = Tape<'array'>;

const parentOf = (i: number) => (i - 1) >> 1;

/** The words and comparisons of one order. */
function orderOf(order: HeapOrder) {
  const min = order === 'min';
  return {
    order,
    /** Whether `a` belongs above `b`. */
    above: (a: number, b: number) => (min ? a < b : a > b),
    /** `a above b`, `a not above b`, and the reverse, in narration. */
    less: min ? '<' : '>',
    notLess: min ? '≥' : '≤',
    more: min ? '>' : '<',
    notMore: min ? '≤' : '≥',
    /** `a not below b` in Python and in pseudocode. */
    lessEq: min ? '<=' : '>=',
    notAbove: min ? '≤' : '≥',
    /**
     * `x wrongWay h[i]`: a key change in the direction this heap does not
     * allow, larger in a min-heap and smaller in a max-heap.
     */
    wrongWay: min ? '>' : '<',
    extreme: min ? 'minimum' : 'maximum',
    child: min ? 'smaller' : 'larger',
    change: min ? ('decreaseKey' as const) : ('increaseKey' as const),
  };
}
type Order = ReturnType<typeof orderOf>;

const swapItems = (items: readonly Item[], i: number, j: number) =>
  items.map((x, k) => (k === i ? items[j]! : k === j ? items[i]! : x));

function swapStep(tape: T, items: readonly Item[], i: number, j: number) {
  tape.step('swap', `Swap ${items[i]!.value} and ${items[j]!.value}.`);
  tape.on.swap({ i, j });
  return swapItems(items, i, j);
}

function siftUp(items: readonly Item[], i: number, o: Order, tape: T) {
  let h = items;
  while (i > 0) {
    const p = parentOf(i);
    const [x, y] = [h[i]!.value, h[p]!.value];
    const up = o.above(x, y);
    tape.step(
      'compare',
      `${x} ${up ? o.less : o.notLess} ${y}, its parent: ${up ? 'swap up' : 'stop'}.`,
    );
    tape.on.compare({ i, j: p });
    if (!up) break;
    h = swapStep(tape, h, i, p);
    i = p;
  }
  return h;
}

function siftDown(items: readonly Item[], o: Order, tape: T) {
  let h = items;
  for (let i = 0; 2 * i + 1 < h.length;) {
    let c = 2 * i + 1;
    if (c + 1 < h.length && o.above(h[c + 1]!.value, h[c]!.value)) c += 1;
    const [x, y] = [h[i]!.value, h[c]!.value];
    const down = o.above(y, x);
    tape.step(
      'compare',
      `${x} ${down ? o.more : o.notMore} ${y}, the ${o.child} child: ${down ? 'swap down' : 'stop'}.`,
    );
    tape.on.compare({ i, j: c });
    if (!down) break;
    h = swapStep(tape, h, i, c);
    i = c;
  }
  return h;
}

// Sifting up, indented as the body of the functions it ends.
const SIFT_UP = {
  pseudocode: (o: Order) => `
            while i > 0
                p = ⌊(i - 1) / 2⌋  // the parent of i, counting from 0
                if h[p] ${o.notAbove} h[i]  // @compare
                    return
                exchange h[i] with h[p]  // @swap
                i = p`,
  python: (o: Order) => `
            while i > 0:
                p = (i - 1) // 2
                if h[p] ${o.lessEq} h[i]:  # @compare
                    break
                h[i], h[p] = h[p], h[i]  # @swap
                i = p`,
};

const codes = (o: Order) => {
  const change = o.order === 'min' ? 'decrease' : 'increase';
  const way = o.order === 'min' ? 'larger' : 'smaller';
  return {
    push: listing('push', {
      pseudocode: `
        HEAP-PUSH(h, x)
            h.size = h.size + 1
            h[h.size - 1] = x  // @append
            i = h.size - 1${SIFT_UP.pseudocode(o)}
      `,
      python: `
        def push(h, x):
            h.append(x)  # @append
            i = len(h) - 1${SIFT_UP.python(o)}
      `,
    }),
    pop: listing('pop', {
      pseudocode: `
        HEAP-POP(h)
            exchange h[0] with h[h.size - 1]  // @swap-last
            top = h[h.size - 1]
            h.size = h.size - 1  // @remove
            i = 0
            while 2i + 1 < h.size
                c = 2i + 1  // the left child of i, counting from 0
                if c + 1 < h.size and h[c + 1] ${o.less} h[c]
                    c = c + 1
                if h[i] ${o.notAbove} h[c]  // @compare
                    return top
                exchange h[i] with h[c]  // @swap
                i = c
            return top
      `,
      python: `
        def pop(h):
            h[0], h[-1] = h[-1], h[0]  # @swap-last
            top = h.pop()  # @remove
            i = 0
            while 2 * i + 1 < len(h):
                c = 2 * i + 1
                if c + 1 < len(h) and h[c + 1] ${o.less} h[c]:
                    c += 1
                if h[i] ${o.lessEq} h[c]:  # @compare
                    break
                h[i], h[c] = h[c], h[i]  # @swap
                i = c
            return top
      `,
    }),
    change: listing(`${change}-key`, {
      pseudocode: `
        HEAP-${change.toUpperCase()}-KEY(h, i, x)
            if x ${o.wrongWay} h[i]
                error "x is ${way} than h[i]"
            h[i] = x  // @set${SIFT_UP.pseudocode(o)}
      `,
      python: `
        def ${change}_key(h, i, x):
            if x ${o.wrongWay} h[i]:
                raise ValueError("x is ${way} than h[i]")
            h[i] = x  # @set${SIFT_UP.python(o)}
      `,
    }),
  };
};

function push(
  s: HeapState,
  value: number,
  o: Order,
  tape: T,
): Applied<HeapState> {
  if (s.items.length >= MAX_SIZE)
    throw new RangeError(
      `The heap is full: it holds at most ${MAX_SIZE} values`,
    );
  const item = { id: `h${s.next}`, value };
  tape.step('append', `Put ${value} at the end.`);
  tape.on.insert({ index: s.items.length, element: item });
  const items = siftUp([...s.items, item], s.items.length, o, tape);
  return { state: { items, next: s.next + 1 }, result: null };
}

function pop(s: HeapState, o: Order, tape: T): Applied<HeapState> {
  if (s.items.length === 0)
    throw new RangeError('The heap is empty: there is nothing to pop');
  const last = s.items.length - 1;
  const top = s.items[0]!.value;
  if (last > 0) {
    tape.step(
      'swap-last',
      `Move the last value ${s.items[last]!.value} to the root, and ${top} to the end.`,
    );
    tape.on.swap({ i: 0, j: last });
  }
  tape.step('remove', `Remove ${top}: it is the ${o.extreme}.`);
  tape.on.remove({ index: last });
  const items = siftDown(swapItems(s.items, 0, last).slice(0, last), o, tape);
  return { state: { ...s, items }, result: top };
}

function changeKey(
  s: HeapState,
  index: number,
  value: number,
  o: Order,
  tape: T,
): Applied<HeapState> {
  const n = s.items.length;
  if (index >= n)
    throw new RangeError(
      `index ${index} is past the end of the heap (${n} values)`,
    );
  const old = s.items[index]!.value;
  if (o.above(old, value))
    throw new RangeError(
      `${o.change} must not ${o.order === 'min' ? 'increase' : 'decrease'} h[${index}] (${old}) to ${value}`,
    );
  const verb = o.order === 'min' ? 'Decrease' : 'Increase';
  tape.step('set', `${verb} h[${index}] from ${old} to ${value}.`);
  tape.on.set({ index, value });
  const changed = s.items.map((x, k) => (k === index ? { ...x, value } : x));
  return {
    state: { ...s, items: siftUp(changed, index, o, tape) },
    result: null,
  };
}

/** Checks that `array` is a heap, naming the first parent and child that break it. */
function checkHeap(array: readonly number[], o: Order): void {
  array.forEach((value, i) => {
    const p = parentOf(i);
    if (i > 0 && o.above(value, array[p]!))
      throw new RangeError(
        `Not a ${o.order}-heap: ${array[p]} at index ${p} comes after its child ${value} at index ${i}`,
      );
  });
}

/** The values `from` lists, and whether they already form a heap. */
function valuesOf(from: HeapFrom): {
  readonly values: readonly number[];
  readonly given: boolean;
} {
  if (Array.isArray(from)) return { values: from, given: false };
  const array: unknown =
    typeof from === 'object' && from !== null && 'array' in from
      ? from.array
      : undefined;
  if (!Array.isArray(array))
    throw new RangeError('from must be an array of values or { array }');
  return { values: array, given: true };
}

function start(from: HeapFrom, o: Order): HeapState {
  const { values, given } = valuesOf(from);
  checkLength('from', values, MAX_SIZE);
  checkFinite('from', values);
  if (!given) {
    const tape = silentTape('array');
    const empty: HeapState = { items: [], next: 0 };
    return values.reduce((s, v) => push(s, v, o, tape).state, empty);
  }
  checkHeap(values, o);
  return {
    items: values.map((value, k) => ({ id: `h${k}`, value })),
    next: values.length,
  };
}

function heapDef(
  order: HeapOrder,
): StructureDef<HeapState, HeapFrom, 'array', HeapCall> {
  const o = orderOf(order);
  const code: Record<'push' | 'pop' | 'change', Listing> = codes(o);
  return {
    name: 'heap',
    kind: 'array',
    title: `Binary ${order}-heap`,
    start: (from) => start(from, o),
    describe: (s) => ({ array: s.items.map((x) => x.value) }),
    declare: (s) => ({ kind: 'array', view: 'tree', initial: [...s.items] }),
    clear: () => undefined,
    check(call) {
      const other = order === 'min' ? 'increaseKey' : 'decreaseKey';
      if (call.op === other)
        throw new RangeError(
          `${call.op} is for ${order === 'min' ? 'max' : 'min'}-heaps; use ${o.change}`,
        );
      checkOp(call.op, ['push', 'pop', o.change]);
      if (call.op === 'pop') return;
      checkFinite('value', [call.value]);
      if (call.op === 'push') return;
      checkInteger('index', call.index, 0, MAX_SIZE - 1);
    },
    titleOf: (call) =>
      call.op === 'push'
        ? `push ${call.value}`
        : call.op === 'pop'
          ? 'pop'
          : `${call.op === 'decreaseKey' ? 'decrease' : 'increase'} key at ${call.index} to ${call.value}`,
    code: (call) =>
      call.op === 'push'
        ? code.push
        : call.op === 'pop'
          ? code.pop
          : code.change,
    apply(s, call, tape) {
      if (call.op === 'push') return push(s, call.value, o, tape);
      if (call.op === 'pop') return pop(s, o, tape);
      return changeKey(s, call.index, call.value, o, tape);
    },
  };
}

const DEFS = { min: heapDef('min'), max: heapDef('max') };

/** Where a heap operation starts, and its order. */
export interface HeapArgs {
  readonly from: HeapFrom;
  readonly order?: HeapOrder;
}

/** Operations on a binary heap, a min-heap unless `order` is `'max'`. */
export const heap = {
  run: (
    args: HeapArgs & { readonly ops: readonly HeapCall[] },
  ): OpRun<HeapFrom> => runOps(DEFS[args.order ?? 'min'], args.from, args.ops),
  push: ({ from, order, value }: HeapArgs & { readonly value: number }) =>
    runOps(DEFS[order ?? 'min'], from, [{ op: 'push', value }]),
  pop: ({ from, order }: HeapArgs) =>
    runOps(DEFS[order ?? 'min'], from, [{ op: 'pop' }]),
  decreaseKey: ({
    from,
    index,
    value,
  }: {
    readonly from: HeapFrom;
    readonly index: number;
    readonly value: number;
  }) => runOps(DEFS.min, from, [{ op: 'decreaseKey', index, value }]),
  increaseKey: ({
    from,
    index,
    value,
  }: {
    readonly from: HeapFrom;
    readonly index: number;
    readonly value: number;
  }) => runOps(DEFS.max, from, [{ op: 'increaseKey', index, value }]),
};
