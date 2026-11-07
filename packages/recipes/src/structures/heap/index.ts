/**
 * Binary heap operations (ADR 0018, 0019): push, pop and, on a min-heap,
 * decrease-key or, on a max-heap, increase-key, each from a heap given as
 * values to push or as an array that already is a heap, and a sequence of
 * them. A min-heap and a max-heap are two structures, `min-heap` and
 * `max-heap`. The heap is an array shown as a tree, as in `binaryHeap`.
 * The code is in pseudocode and Python (ADR 0017), both with indices from
 * 0.
 */
import { z } from 'zod';

import type { Handle } from '../../recorder.ts';
import { listing } from '../../snippet.ts';
import {
  defineStructure,
  MAX_SIZE,
  operationsOf,
  type Applied,
  type Structure,
} from '../../structure.ts';
import { silentHandle, silentTrace, type Trace } from '../../trace.ts';

export type HeapOrder = 'min' | 'max';

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

type On = Handle<'array'>;

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
    change: min ? ('decrease-key' as const) : ('increase-key' as const),
  };
}
type Order = ReturnType<typeof orderOf>;

const swapItems = (items: readonly Item[], i: number, j: number) =>
  items.map((x, k) => (k === i ? items[j]! : k === j ? items[i]! : x));

function swapStep(
  trace: Trace,
  on: On,
  items: readonly Item[],
  i: number,
  j: number,
) {
  trace.step('swap', `Swap ${items[i]!.value} and ${items[j]!.value}.`);
  on.swap({ i, j });
  return swapItems(items, i, j);
}

function siftUp(
  items: readonly Item[],
  i: number,
  o: Order,
  trace: Trace,
  on: On,
) {
  let h = items;
  while (i > 0) {
    const p = parentOf(i);
    const [x, y] = [h[i]!.value, h[p]!.value];
    const up = o.above(x, y);
    trace.step(
      'compare',
      `${x} ${up ? o.less : o.notLess} ${y}, its parent: ${up ? 'swap up' : 'stop'}.`,
    );
    on.compare({ i, j: p });
    if (!up) break;
    h = swapStep(trace, on, h, i, p);
    i = p;
  }
  return h;
}

function siftDown(items: readonly Item[], o: Order, trace: Trace, on: On) {
  let h = items;
  for (let i = 0; 2 * i + 1 < h.length;) {
    let c = 2 * i + 1;
    if (c + 1 < h.length && o.above(h[c + 1]!.value, h[c]!.value)) c += 1;
    const [x, y] = [h[i]!.value, h[c]!.value];
    const down = o.above(y, x);
    trace.step(
      'compare',
      `${x} ${down ? o.more : o.notMore} ${y}, the ${o.child} child: ${down ? 'swap down' : 'stop'}.`,
    );
    on.compare({ i, j: c });
    if (!down) break;
    h = swapStep(trace, on, h, i, c);
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
  trace: Trace,
  on: On,
): Applied<HeapState> {
  if (s.items.length >= MAX_SIZE)
    throw new RangeError(
      `The heap is full: it holds at most ${MAX_SIZE} values`,
    );
  const item = { id: `h${s.next}`, value };
  trace.step('append', `Put ${value} at the end.`);
  on.insert({ index: s.items.length, element: item });
  const items = siftUp([...s.items, item], s.items.length, o, trace, on);
  return { state: { items, next: s.next + 1 }, result: null };
}

function pop(s: HeapState, o: Order, trace: Trace, on: On): Applied<HeapState> {
  if (s.items.length === 0)
    throw new RangeError('The heap is empty: there is nothing to pop');
  const last = s.items.length - 1;
  const top = s.items[0]!.value;
  if (last > 0) {
    trace.step(
      'swap-last',
      `Move the last value ${s.items[last]!.value} to the root, and ${top} to the end.`,
    );
    on.swap({ i: 0, j: last });
  }
  trace.step('remove', `Remove ${top}: it is the ${o.extreme}.`);
  on.remove({ index: last });
  const items = siftDown(
    swapItems(s.items, 0, last).slice(0, last),
    o,
    trace,
    on,
  );
  return { state: { ...s, items }, result: top };
}

function changeKey(
  s: HeapState,
  index: number,
  value: number,
  o: Order,
  trace: Trace,
  on: On,
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
  trace.step('set', `${verb} h[${index}] from ${old} to ${value}.`);
  on.set({ index, value });
  const changed = s.items.map((x, k) => (k === index ? { ...x, value } : x));
  return {
    state: { ...s, items: siftUp(changed, index, o, trace, on) },
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
  return Array.isArray(from)
    ? { values: from, given: false }
    : {
        values: (from as { readonly array: readonly number[] }).array,
        given: true,
      };
}

function start(from: HeapFrom, o: Order): HeapState {
  const { values, given } = valuesOf(from);
  if (!given) {
    const trace = silentTrace();
    const on = silentHandle('array');
    const empty: HeapState = { items: [], next: 0 };
    return values.reduce((s, v) => push(s, v, o, trace, on).state, empty);
  }
  checkHeap(values, o);
  return {
    items: values.map((value, k) => ({ id: `h${k}`, value })),
    next: values.length,
  };
}

const Values = z.array(z.number()).max(MAX_SIZE);
const From = z
  .union(
    [
      Values.describe('Values pushed one by one to build the heap.'),
      z.strictObject({
        array: Values.describe('An array that already is a heap.'),
      }),
    ],
    {
      // A union reports only that no form matched; say what the forms are.
      error: (issue) =>
        issue.code === 'invalid_union'
          ? `from must be up to ${MAX_SIZE} numbers to push, or { array } of up to ${MAX_SIZE} numbers that already is a heap`
          : undefined,
    },
  )
  .describe(
    'The starting heap: values to push, or { array } that already is a heap.',
  );
const Value = z.number();
const Index = z
  .int()
  .min(0)
  .max(MAX_SIZE - 1)
  .describe('Position in the heap array, from 0.');

const sample = [5, 3, 8, 1, 9, 2];

/** The modules of a min-heap or a max-heap. */
function heapStructure(order: HeapOrder): Structure {
  const o = orderOf(order);
  const code = codes(o);
  const op = operationsOf<HeapState, HeapFrom, 'array'>();
  const [change, way] =
    order === 'min' ? ['decrease', 'smaller'] : ['increase', 'larger'];
  return defineStructure<HeapState, HeapFrom, 'array'>({
    id: `${order}-heap`,
    title: `Binary ${order}-heap`,
    topic: 'heaps',
    summary: `Pushes, pops and ${change}s keys one after another in a binary ${order}-heap stored as an array.`,
    name: 'heap',
    kind: 'array',
    from: From,
    examples: [
      {
        from: sample,
        ops: [
          { op: 'push', value: order === 'min' ? 0 : 10 },
          { op: 'pop' },
          { op: `${change}-key`, index: 4, value: order === 'min' ? 2 : 7 },
        ],
      },
    ],
    start: (from) => start(from, o),
    describe: (s) => ({ array: s.items.map((x) => x.value) }),
    declare: (s) => ({ kind: 'array', view: 'tree', initial: [...s.items] }),
    clear: () => undefined,
    operations: [
      op({
        name: 'push',
        title: 'push',
        summary: `Puts a value at the end of a binary ${order}-heap and sifts it up.`,
        args: { value: Value.describe('The value to push.') },
        examples: [{ from: sample, value: order === 'min' ? 0 : 10 }],
        code: code.push,
        titleOf: ({ value }) => `push ${value}`,
        apply: (s, { value }, trace, on) => push(s, value, o, trace, on),
      }),
      op({
        name: 'pop',
        title: 'pop',
        summary: `Removes the ${o.extreme} of a binary ${order}-heap: the last value moves to the root and sifts down.`,
        args: {},
        examples: [{ from: sample }],
        code: code.pop,
        titleOf: () => 'pop',
        apply: (s, _, trace, on) => pop(s, o, trace, on),
      }),
      op({
        name: `${change}-key`,
        title: `${change} key`,
        summary: `Makes the value at an index of a binary ${order}-heap ${way} and sifts it up.`,
        args: {
          index: Index,
          value: Value.describe(
            `The new value, no ${order === 'min' ? 'larger' : 'smaller'} than the old one.`,
          ),
        },
        examples: [{ from: sample, index: 4, value: order === 'min' ? 0 : 10 }],
        code: code.change,
        titleOf: ({ index, value }) => `${change} key at ${index} to ${value}`,
        apply: (s, { index, value }, trace, on) =>
          changeKey(s, index, value, o, trace, on),
      }),
    ],
  });
}

/** Operations on a binary min-heap. */
export const minHeap = heapStructure('min');

/** Operations on a binary max-heap. */
export const maxHeap = heapStructure('max');
