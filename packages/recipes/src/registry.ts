/**
 * The registry (ADR 0019): every module, listed explicitly, and running one
 * by id. MCP, the command line, the playground and the packages for Typst
 * and LaTeX all read it, so adding an algorithm means adding its module
 * here.
 */
import { err, type Diagnostic, type Result } from '@algoviz/spec';

import type { Algorithm } from './algorithm.ts';
import { runModule, type AlgorithmRun } from './run-module.ts';
import { bst } from './structures/bst/index.ts';
import { maxHeap, minHeap } from './structures/heap/index.ts';

/** Every module, grouped by topic in menu order. */
export const algorithms: readonly Algorithm[] = [
  ...bst.modules,
  ...minHeap.modules,
  ...maxHeap.modules,
];

/** The module with `id`, if there is one. */
export const findAlgorithm = (id: string): Algorithm | undefined =>
  algorithms.find((a) => a.id === id);

/**
 * Runs the module with `id` on `input` (see `runModule`); an unknown id is
 * an `UNKNOWN_ALGORITHM` error at `$.id`.
 */
export function runAlgorithm(
  id: string,
  input: unknown,
): Result<AlgorithmRun, readonly Diagnostic[]> {
  const algorithm = findAlgorithm(id);
  if (algorithm === undefined)
    return err([
      {
        code: 'UNKNOWN_ALGORITHM',
        path: '$.id',
        message: `No algorithm with id "${id}"`,
        hint: `Ids: ${algorithms.map((a) => a.id).join(', ')}.`,
      },
    ]);
  return runModule(algorithm, input);
}
