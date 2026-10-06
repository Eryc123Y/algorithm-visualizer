/**
 * Sorting algorithms on an array named `a`.
 */
import type { VisualizationInput } from '@algoviz/spec';

import { Recorder } from './recorder.ts';
import { python } from './source.ts';

export function bubbleSort(values: readonly number[]): VisualizationInput {
  const r = new Recorder({
    title: 'Bubble sort',
    source: python(`
      def bubble_sort(a):
          n = len(a)
          for i in range(n - 1):
              for j in range(n - 1 - i):
                  if a[j] > a[j + 1]:
                      a[j], a[j + 1] = a[j + 1], a[j]
              # a[n - 1 - i] is now in place
    `),
  });
  const a = values.slice();
  const arr = r.add('a', { kind: 'array', initial: [...values] });
  const n = a.length;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1 - i; j++) {
      r.step({
        line: 5,
        narration: `Compare ${a[j]} and ${a[j + 1]}.`,
        vars: { i, j },
      });
      arr.pointer({ name: 'j', index: j }).compare({ i: j, j: j + 1 });
      if (a[j]! > a[j + 1]!) {
        r.step({ line: 6, narration: `${a[j]} > ${a[j + 1]}, so swap them.` });
        arr.swap({ i: j, j: j + 1 });
        [a[j], a[j + 1]] = [a[j + 1]!, a[j]!];
      }
    }
    r.step({ line: 7, narration: `${a[n - 1 - i]} is in its final position.` });
    arr.pointer({ name: 'j', index: null }).settle({ index: n - 1 - i });
  }
  if (n > 0) {
    r.step('The array is sorted.');
    arr.settle({ index: 0 });
  }
  return r.build();
}

export function insertionSort(values: readonly number[]): VisualizationInput {
  const r = new Recorder({
    title: 'Insertion sort',
    source: python(`
      def insertion_sort(a):
          for i in range(1, len(a)):
              j = i
              while j > 0 and a[j - 1] > a[j]:
                  a[j - 1], a[j] = a[j], a[j - 1]
                  j -= 1
    `),
  });
  const a = values.slice();
  const arr = r.add('a', { kind: 'array', initial: [...values] });
  for (let i = 1; i < a.length; i++) {
    r.step({
      line: 2,
      narration: `Insert ${a[i]} into the sorted prefix a[0..${i - 1}].`,
      vars: { i },
    });
    arr.pointer({ name: 'i', index: i }).highlight({ indices: [i] });
    let j = i;
    while (j > 0) {
      r.step({
        line: 4,
        narration: `Compare ${a[j - 1]} and ${a[j]}.`,
        vars: { i, j },
      });
      arr.pointer({ name: 'j', index: j }).compare({ i: j - 1, j });
      if (a[j - 1]! <= a[j]!) break;
      r.step({
        line: 5,
        narration: `${a[j - 1]} > ${a[j]}: move ${a[j]} left.`,
      });
      arr.swap({ i: j - 1, j });
      [a[j - 1], a[j]] = [a[j]!, a[j - 1]!];
      j--;
    }
    arr.pointer({ name: 'j', index: null });
  }
  r.step('The array is sorted.');
  arr.pointer({ name: 'i', index: null });
  a.forEach((_, k) => arr.settle({ index: k }));
  return r.build();
}

export function selectionSort(values: readonly number[]): VisualizationInput {
  const r = new Recorder({
    title: 'Selection sort',
    source: python(`
      def selection_sort(a):
          n = len(a)
          for i in range(n - 1):
              m = i
              for j in range(i + 1, n):
                  if a[j] < a[m]:
                      m = j
              a[i], a[m] = a[m], a[i]
    `),
  });
  const a = values.slice();
  const arr = r.add('a', { kind: 'array', initial: [...values] });
  const n = a.length;
  for (let i = 0; i < n - 1; i++) {
    let m = i;
    r.step({
      line: 4,
      narration: `Find the smallest value in a[${i}..${n - 1}].`,
      vars: { i },
    });
    arr.pointer({ name: 'i', index: i }).pointer({ name: 'min', index: m });
    for (let j = i + 1; j < n; j++) {
      r.step({
        line: 6,
        narration: `Is ${a[j]} smaller than ${a[m]}?`,
        vars: { i, j, m },
      });
      arr.pointer({ name: 'j', index: j }).compare({ i: j, j: m });
      if (a[j]! < a[m]!) {
        m = j;
        r.step({ line: 7, narration: `Yes: ${a[m]} is the smallest so far.` });
        arr.pointer({ name: 'min', index: m });
      }
    }
    r.step({
      line: 8,
      narration:
        m === i
          ? `${a[i]} is already in place.`
          : `Swap ${a[m]} into position ${i}.`,
    });
    arr.pointer({ name: 'j', index: null });
    if (m !== i) {
      arr.swap({ i, j: m });
      [a[i], a[m]] = [a[m]!, a[i]!];
    }
    arr.settle({ index: i });
  }
  if (n > 0) {
    r.step('The array is sorted.');
    arr
      .pointer({ name: 'i', index: null })
      .pointer({ name: 'min', index: null });
    arr.settle({ index: n - 1 });
  }
  return r.build();
}

export function mergeSort(values: readonly number[]): VisualizationInput {
  const r = new Recorder({
    title: 'Merge sort',
    source: python(`
      def merge_sort(a, lo, hi):
          if hi <= lo: return
          mid = (lo + hi) // 2
          merge_sort(a, lo, mid)
          merge_sort(a, mid + 1, hi)
          aux[lo:hi + 1] = a[lo:hi + 1]
          i, j = lo, mid + 1
          for k in range(lo, hi + 1):
              if j > hi or (i <= mid and aux[i] <= aux[j]):
                  a[k] = aux[i]; i += 1
              else:
                  a[k] = aux[j]; j += 1
    `),
  });
  const a = values.slice();
  const aux: (number | string)[] = values.map(() => '');
  const arr = r.add('a', { kind: 'array', initial: [...values] });
  const tmp = r.add('aux', { kind: 'array', initial: [...aux] });
  const range = (lo: number, hi: number) =>
    Array.from({ length: hi - lo + 1 }, (_, k) => lo + k);

  const sort = (lo: number, hi: number): void => {
    if (hi <= lo) return;
    const mid = (lo + hi) >> 1;
    sort(lo, mid);
    sort(mid + 1, hi);
    r.step({
      line: 6,
      narration: `Merge a[${lo}..${mid}] and a[${mid + 1}..${hi}]: copy them to aux.`,
    });
    arr.highlight({ indices: range(lo, hi) });
    for (const k of range(lo, hi)) {
      aux[k] = a[k]!;
      tmp.set({ index: k, value: a[k]! });
    }
    let i = lo;
    let j = mid + 1;
    for (const k of range(lo, hi)) {
      const takeLeft =
        j > hi || (i <= mid && (aux[i] as number) <= (aux[j] as number));
      r.step({
        line: takeLeft ? 10 : 12,
        narration:
          j > hi
            ? `The right half is used up: take ${aux[i]}.`
            : i > mid
              ? `The left half is used up: take ${aux[j]}.`
              : `${aux[i]} ${takeLeft ? '≤' : '>'} ${aux[j]}: take ${takeLeft ? aux[i] : aux[j]}.`,
        vars: { k },
      });
      tmp.pointer({ name: 'i', index: i <= mid ? i : null });
      tmp.pointer({ name: 'j', index: j <= hi ? j : null });
      if (i <= mid && j <= hi) tmp.compare({ i, j });
      arr.pointer({ name: 'k', index: k });
      const from = takeLeft ? i++ : j++;
      a[k] = aux[from] as number;
      arr.set({ index: k, value: a[k] });
    }
    r.step({ line: 8, narration: `a[${lo}..${hi}] is sorted.` });
    tmp.pointer({ name: 'i', index: null }).pointer({ name: 'j', index: null });
    arr.pointer({ name: 'k', index: null });
    for (const k of range(lo, hi)) tmp.set({ index: k, value: '' });
  };
  sort(0, a.length - 1);
  r.step('The array is sorted.');
  a.forEach((_, k) => arr.settle({ index: k }));
  return r.build();
}

export function quickSort(values: readonly number[]): VisualizationInput {
  const r = new Recorder({
    title: 'Quicksort (Lomuto partition)',
    source: python(`
      def quick_sort(a, lo, hi):
          if lo >= hi: return
          pivot = a[hi]
          i = lo
          for j in range(lo, hi):
              if a[j] < pivot:
                  a[i], a[j] = a[j], a[i]
                  i += 1
          a[i], a[hi] = a[hi], a[i]
          quick_sort(a, lo, i - 1)
          quick_sort(a, i + 1, hi)
    `),
  });
  const a = values.slice();
  const arr = r.add('a', { kind: 'array', initial: [...values] });

  const sort = (lo: number, hi: number): void => {
    if (lo > hi) return;
    if (lo === hi) {
      r.step({ line: 2, narration: `a[${lo}] = ${a[lo]} alone is in place.` });
      arr.settle({ index: lo });
      return;
    }
    const pivot = a[hi]!;
    r.step({
      line: 3,
      narration: `Partition a[${lo}..${hi}] around the pivot ${pivot}.`,
    });
    arr.highlight({ indices: [hi] }).pointer({ name: 'i', index: lo });
    let i = lo;
    for (let j = lo; j < hi; j++) {
      r.step({ line: 6, narration: `Is ${a[j]} < ${pivot}?`, vars: { i, j } });
      arr.pointer({ name: 'j', index: j }).compare({ i: j, j: hi });
      if (a[j]! < pivot) {
        r.step({
          line: 7,
          narration:
            i === j
              ? `Yes: ${a[j]} stays on the left.`
              : `Yes: swap ${a[j]} to the left part.`,
        });
        if (i !== j) {
          arr.swap({ i, j });
          [a[i], a[j]] = [a[j]!, a[i]!];
        }
        i++;
        arr.pointer({ name: 'i', index: i });
      }
    }
    r.step({
      line: 9,
      narration: `Put the pivot ${pivot} between the parts, at ${i}.`,
    });
    arr.pointer({ name: 'j', index: null });
    if (i !== hi) {
      arr.swap({ i, j: hi });
      [a[i], a[hi]] = [a[hi]!, a[i]!];
    }
    arr.settle({ index: i }).pointer({ name: 'i', index: null });
    sort(lo, i - 1);
    sort(i + 1, hi);
  };
  sort(0, a.length - 1);
  r.step('The array is sorted.');
  return r.build();
}

export function heapSort(values: readonly number[]): VisualizationInput {
  const r = new Recorder({
    title: 'Heapsort',
    source: python(`
      def heap_sort(a):
          n = len(a)
          for i in range(n // 2 - 1, -1, -1):
              sift_down(a, i, n)
          for end in range(n - 1, 0, -1):
              a[0], a[end] = a[end], a[0]
              sift_down(a, 0, end)

      def sift_down(a, i, n):
          while 2 * i + 1 < n:
              c = 2 * i + 1
              if c + 1 < n and a[c + 1] > a[c]: c += 1
              if a[i] >= a[c]: return
              a[i], a[c] = a[c], a[i]
              i = c
    `),
  });
  const a = values.slice();
  const heap = r.add('a', {
    kind: 'array',
    view: 'tree',
    initial: [...values],
  });

  const siftDown = (start: number, n: number) => {
    let i = start;
    while (2 * i + 1 < n) {
      let c = 2 * i + 1;
      if (c + 1 < n) {
        r.step({
          line: 12,
          narration: `Pick the larger child of ${a[i]}: ${a[c]} or ${a[c + 1]}.`,
        });
        heap.compare({ i: c, j: c + 1 });
        if (a[c + 1]! > a[c]!) c++;
      }
      r.step({ line: 13, narration: `Is ${a[i]} ≥ its larger child ${a[c]}?` });
      heap.pointer({ name: 'i', index: i }).compare({ i, j: c });
      if (a[i]! >= a[c]!) break;
      r.step({ line: 14, narration: `No: swap ${a[i]} down.` });
      heap.swap({ i, j: c });
      [a[i], a[c]] = [a[c]!, a[i]!];
      i = c;
    }
    heap.pointer({ name: 'i', index: null });
  };

  const n = a.length;
  r.step({ line: 3, narration: 'Build a max-heap from the bottom up.' });
  for (let i = (n >> 1) - 1; i >= 0; i--) siftDown(i, n);
  for (let end = n - 1; end > 0; end--) {
    r.step({
      line: 6,
      narration: `Move the maximum ${a[0]} to the end, position ${end}.`,
    });
    heap.swap({ i: 0, j: end }).settle({ index: end });
    [a[0], a[end]] = [a[end]!, a[0]!];
    siftDown(0, end);
  }
  if (n > 0) {
    r.step('The array is sorted.');
    heap.settle({ index: 0 });
  }
  return r.build();
}

export function countingSort(values: readonly number[]): VisualizationInput {
  if (values.some((v) => !Number.isInteger(v) || v < 0 || v > 99))
    throw new RangeError('Counting sort here takes integers from 0 to 99');
  const max = Math.max(0, ...values);
  const r = new Recorder({
    title: 'Counting sort',
    source: python(`
      def counting_sort(a, k):
          count = [0] * (k + 1)
          for x in a:
              count[x] += 1
          i = 0
          for v in range(k + 1):
              for _ in range(count[v]):
                  a[i] = v
                  i += 1
    `),
  });
  const a = values.slice();
  const count = Array.from({ length: max + 1 }, () => 0);
  const arr = r.add('a', { kind: 'array', initial: [...values] });
  const counts = r.add('count', { kind: 'array', initial: [...count] });
  a.forEach((x, k) => {
    count[x]!++;
    r.step({ line: 4, narration: `Count ${x}.` });
    arr.pointer({ name: 'x', index: k }).highlight({ indices: [k] });
    counts.set({ index: x, value: count[x]! }).highlight({ indices: [x] });
  });
  arr.pointer({ name: 'x', index: null });
  let i = 0;
  for (let v = 0; v <= max; v++) {
    for (let c = 0; c < count[v]!; c++) {
      r.step({ line: 8, narration: `Write ${v} at position ${i}.` });
      counts.pointer({ name: 'v', index: v });
      arr.set({ index: i, value: v }).settle({ index: i });
      a[i++] = v;
    }
  }
  r.step('The array is sorted.');
  counts.pointer({ name: 'v', index: null });
  return r.build();
}
