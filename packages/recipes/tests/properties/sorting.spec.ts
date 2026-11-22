/**
 * Property tests of the recipes (recipe-properties.ts): insertion sort,
 * merge sort and heapsort.
 * Random inputs from each recipe's domain must give a document that loads,
 * ends with the right answer (checked against independent reference
 * implementations), lays out inside a fixed-size scene in every frame,
 * renders to clean SVG and runs the same in Chinese.
 *
 * Run bigger with e.g. `FUZZ_RUNS=2000 npx vitest run --project recipes
 * tests/properties/sorting.spec.ts`.
 */
import { comparisonSort } from './shared.ts';

for (const id of ['insertion-sort', 'merge-sort', 'heapsort'])
  comparisonSort(id);
