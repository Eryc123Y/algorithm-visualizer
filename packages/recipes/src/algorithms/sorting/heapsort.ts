/**
 * Heapsort, as in CLRS: BUILD-MAX-HEAP sifts every parent down, from the
 * last one to the root, with MAX-HEAPIFY; then the maximum moves to the end
 * of the heap, the heap shrinks by one, and the root is sifted down again.
 * The array is drawn as the tree it stands for.
 */
import { defineAlgorithm } from '../../algorithm.ts';
import { SAMPLE, SortInput } from './input.ts';

export const heapsort = defineAlgorithm({
  id: 'heapsort',
  title: 'Heapsort',
  topic: 'sorting',
  summary:
    'Builds a max-heap in the array, then repeatedly moves the maximum to the end and sifts the new root down.',
  input: SortInput,
  examples: [SAMPLE],
  code: {
    pseudocode: `
      HEAPSORT(a, n)
          BUILD-MAX-HEAP(a, n)  // @build
          for last = n - 1 downto 1  // @sorted
              exchange a[0] with a[last]  // @extract
              MAX-HEAPIFY(a, 0, last)

      BUILD-MAX-HEAP(a, n)
          for i = ⌊n / 2⌋ - 1 downto 0
              MAX-HEAPIFY(a, i, n)  // @heapify

      MAX-HEAPIFY(a, i, size)
          l = 2i + 1
          r = 2i + 2
          if l < size and a[l] > a[i]  // @left
              largest = l
          else largest = i
          if r < size and a[r] > a[largest]  // @right
              largest = r
          if largest ≠ i  // @stop
              exchange a[i] with a[largest]  // @swap
              MAX-HEAPIFY(a, largest, size)
    `,
    python: `
      def heapsort(a):
          n = len(a)
          build_max_heap(a, n)  # @build
          for last in range(n - 1, 0, -1):  # @sorted
              a[0], a[last] = a[last], a[0]  # @extract
              max_heapify(a, 0, last)

      def build_max_heap(a, n):
          for i in range(n // 2 - 1, -1, -1):
              max_heapify(a, i, n)  # @heapify

      def max_heapify(a, i, size):
          l, r = 2 * i + 1, 2 * i + 2
          largest = l if l < size and a[l] > a[i] else i  # @left
          if r < size and a[r] > a[largest]:  # @right
              largest = r
          if largest != i:  # @stop
              a[i], a[largest] = a[largest], a[i]  # @swap
              max_heapify(a, largest, size)
    `,
  },
  run({ values }, trace) {
    const a = [...values];
    const n = a.length;
    const heap = trace.add('a', {
      kind: 'array',
      view: 'tree',
      initial: [...values],
    });

    // Sifts a[i] down within a[0..size-1].
    const maxHeapify = (i: number, size: number): void => {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l >= size) {
        // Both tests fail on a leaf, so largest stays i.
        trace.step('stop', `${a[i]} has no children in the heap: stop.`);
        heap.pointer({ name: 'i', index: null });
        return;
      }
      trace.step('left', `Compare ${a[i]} with its left child ${a[l]}.`, {
        vars: { i, l, size },
      });
      heap.pointer({ name: 'i', index: i }).compare({ i, j: l });
      let largest = a[l]! > a[i]! ? l : i;
      if (r < size) {
        trace.step(
          'right',
          `Compare the larger so far, ${a[largest]}, with the right child ${a[r]}.`,
          { vars: { i, largest, r } },
        );
        heap.compare({ i: largest, j: r });
        if (a[r]! > a[largest]!) largest = r;
      }
      if (largest === i) {
        trace.step(
          'stop',
          `${a[i]} is at least as large as its children: this subtree is a max-heap.`,
        );
        heap.pointer({ name: 'i', index: null });
        return;
      }
      trace.step('swap', `Swap ${a[i]} with its larger child ${a[largest]}.`, {
        vars: { i, largest },
      });
      // The pointer follows the value being sifted down.
      heap.swap({ i, j: largest }).pointer({ name: 'i', index: largest });
      [a[i], a[largest]] = [a[largest]!, a[i]!];
      maxHeapify(largest, size);
    };

    trace.step(
      'build',
      'Build a max-heap: sift down every parent, from the last one up to the root.',
    );
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
      trace.step('heapify', `Sift ${a[i]} down from position ${i}.`, {
        vars: { i },
      });
      heap.pointer({ name: 'i', index: i }).highlight({ indices: [i] });
      maxHeapify(i, n);
    }
    for (let last = n - 1; last >= 1; last--) {
      trace.step(
        'extract',
        `Move the maximum ${a[0]} to the end of the heap, position ${last}.`,
        { vars: { last } },
      );
      heap
        .pointer({ name: 'i', index: null })
        .swap({ i: 0, j: last })
        .settle({ index: last });
      [a[0], a[last]] = [a[last]!, a[0]!];
      maxHeapify(0, last);
    }
    trace.step('sorted', 'The array is sorted.');
    heap.pointer({ name: 'i', index: null }).settle({ index: 0 });
  },
});
