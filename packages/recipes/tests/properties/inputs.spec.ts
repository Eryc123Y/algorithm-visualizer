/**
 * Property tests of the recipes (recipe-properties.ts): Well-typed inputs outside what the recipes check.
 * Random inputs from each recipe's domain must give a document that loads,
 * ends with the right answer (checked against independent reference
 * implementations), lays out inside a fixed-size scene in every frame,
 * renders to clean SVG and runs the same in Chinese.
 *
 * Run bigger with e.g. `FUZZ_RUNS=2000 npx vitest run --project recipes
 * tests/properties/inputs.spec.ts`.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { GraphInput } from '../../src/index.ts';
import { runError } from '../helpers.ts';
import { runs, TIMEOUT } from '../recipe-properties.ts';
import {
  clean,
  nodeName,
  type Edge,
  graphs,
  nonNegative,
  total,
  allGraphModules,
} from './shared.ts';

describe('inputs outside the checked domain', () => {
  // Any valid node id is up to 64 characters long; "from-to" edge ids of
  // two such names are not.
  total(
    'graph recipes with long node names',
    fc
      .uniqueArray(fc.stringMatching(/^[A-Za-z0-9_]{1,64}$/), {
        minLength: 1,
        maxLength: 4,
      })
      .filter((nodes) => nodes.every(clean))
      .chain((nodes) =>
        fc.record({
          nodes: fc.constant(nodes),
          edges: fc.array(
            fc
              .tuple(fc.constantFrom(...nodes), fc.constantFrom(...nodes))
              .map(([u, v]): Edge => [u, v, 1]),
            { maxLength: 4 },
          ),
        }),
      ),
    allGraphModules,
  );

  total(
    'graph recipes with an edge to a node that is not in the graph',
    graphs(nonNegative, { minNodes: 1 }).chain((g) =>
      fc
        .tuple(
          nodeName.filter((v) => !g.nodes.includes(v)),
          fc.constantFrom(...g.nodes),
          fc.boolean(),
        )
        .map(([stranger, v, out]): GraphInput => ({
          ...g,
          edges: [...g.edges, out ? [v, stranger] : [stranger, v]],
        })),
    ),
    allGraphModules,
  );

  // Strings longer than 16 characters and more than 8 items are refused
  // at their paths rather than drawn as huge tables.
  it(
    'string tables and knapsack refuse inputs over their limits',
    () => {
      fc.assert(
        fc.property(
          fc.string({
            unit: fc.constantFrom('a', 'b'),
            minLength: 17,
            maxLength: 140,
          }),
          fc.string({ minLength: 1, maxLength: 3 }).filter(clean),
          (long, short) => {
            for (const id of ['lcs', 'edit-distance'])
              expect(runError(id, { first: long, second: short }).path).toBe(
                '$.input.first',
              );
          },
        ),
        { numRuns: runs },
      );
      const items = Array.from({ length: 9 }, () => ({ weight: 1, value: 1 }));
      expect(runError('knapsack', { items, capacity: 3 }).path).toBe(
        '$.input.items',
      );
    },
    TIMEOUT,
  );
});
