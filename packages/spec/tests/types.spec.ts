/**
 * Type-level tests: these assertions are checked by the type checker, not at
 * runtime. They pin down how the inferred protocol types behave.
 */
import { describe, expectTypeOf, it } from 'vitest';

import type {
  ArrayAction,
  minimumVersion,
  ProtocolVersion,
  Result,
  TargetedAction,
  Visualization,
  VisualizationInput,
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

  it('types `version` as one of the versions this package reads', () => {
    expectTypeOf<Visualization['version']>().toEqualTypeOf<ProtocolVersion>();
    expectTypeOf<
      VisualizationInput['version']
    >().toEqualTypeOf<ProtocolVersion>();
    expectTypeOf<ProtocolVersion>().toExtend<string>();
  });

  it('gives writers a version they can put in a document', () => {
    expectTypeOf<
      ReturnType<typeof minimumVersion>
    >().toEqualTypeOf<ProtocolVersion>();
    expectTypeOf<Visualization>().toExtend<
      Parameters<typeof minimumVersion>[0]
    >();
  });

  it('only exposes `value` on successful results', () => {
    type R = Result<number, string>;
    expectTypeOf<Extract<R, { ok: true }>>().toHaveProperty('value');
    expectTypeOf<Extract<R, { ok: false }>>().not.toHaveProperty('value');
  });
});
