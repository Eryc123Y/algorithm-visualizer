/**
 * Type-level tests: these assertions are checked by the type checker, not at
 * runtime. They pin down how the inferred protocol types behave.
 */
import { describe, expectTypeOf, it } from 'vitest';

import type {
  ArrayAction,
  Result,
  TargetedAction,
  Visualization,
} from '../src/index.ts';

describe('protocol types', () => {
  it('narrows actions by their `type` discriminant', () => {
    expectTypeOf<Extract<ArrayAction, { type: 'swap' }>>().toEqualTypeOf<{
      type: 'swap';
      i: number;
      j: number;
    }>();
  });

  it('tags every targeted action with a target', () => {
    expectTypeOf<TargetedAction['target']>().toEqualTypeOf<string>();
    expectTypeOf<ArrayAction['type']>().toExtend<TargetedAction['type']>();
  });

  it('infers optional fields as `?: T | undefined` (Zod behaviour)', () => {
    expectTypeOf<Pick<Visualization, 'title'>>().toEqualTypeOf<{
      title?: string | undefined;
    }>();
  });

  it('only exposes `value` on successful results', () => {
    type R = Result<number, string>;
    expectTypeOf<Extract<R, { ok: true }>>().toHaveProperty('value');
    expectTypeOf<Extract<R, { ok: false }>>().not.toHaveProperty('value');
  });
});
