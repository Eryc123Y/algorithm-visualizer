/**
 * Operations on data structures, each from a given starting state
 * (ADR 0018): `ops.bst.delete({ from, key })` and the like.
 */
import { bst } from './bst.ts';
import { heap } from './heap.ts';

export type { BstCall, BstState } from './bst.ts';
export type {
  HeapArgs,
  HeapCall,
  HeapFrom,
  HeapOrder,
  HeapState,
} from './heap.ts';
export type { OpResult, OpRun } from './run.ts';
export { MAX_OPS, MAX_SIZE } from './run.ts';

export const ops = { bst, heap } as const;
