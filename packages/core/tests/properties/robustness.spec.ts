/**
 * Untrusted input, as models and people write it: arbitrary JSON, and
 * valid documents with random damage. Nothing may throw, every error must
 * point into the input, and parsing a parsed document changes nothing.
 */
import { readdirSync, readFileSync } from 'node:fs';

import { callTool, tools } from '@algomotion/mcp';
import { parseVisualization, type Diagnostic } from '@algomotion/spec';
import { renderSvg } from '@algomotion/svg';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { layoutTrace, loadTrace } from '../../src/index.ts';
import { build } from './build.ts';
import { Dice, RUNS } from './random.ts';

const root = new URL('../../../../conformance/', import.meta.url);
const fixtures: unknown[] = [
  'spec/valid',
  'core/valid',
  'core/invalid',
  'spec/invalid',
].flatMap((dir) =>
  readdirSync(new URL(`${dir}/`, root))
    .filter((f) => f.endsWith('.json'))
    .map(
      (f) =>
        (
          JSON.parse(readFileSync(new URL(`${dir}/${f}`, root), 'utf8')) as {
            input: unknown;
          }
        ).input,
    ),
);

const params = {
  numRuns: RUNS,
  ...(process.env['FUZZ_SEED']
    ? { seed: Number(process.env['FUZZ_SEED']) }
    : {}),
};

/** A document to start from: a fixture or a generated one. */
const seedDocument = fc.oneof(
  fc.constantFrom(...fixtures),
  fc
    .array(fc.nat(), { maxLength: 200 })
    .map((v) => build(new Dice(v)).doc as unknown),
);

/** Every [container, key] in a JSON value, for picking a place to damage. */
function places(value: unknown): [Record<PropertyKey, unknown>, PropertyKey][] {
  const out: [Record<PropertyKey, unknown>, PropertyKey][] = [];
  const walk = (v: unknown) => {
    if (typeof v !== 'object' || v === null) return;
    for (const key of Object.keys(v)) {
      const k = Array.isArray(v) ? Number(key) : key;
      out.push([v as Record<PropertyKey, unknown>, k]);
      walk((v as Record<PropertyKey, unknown>)[k]);
    }
  };
  walk(value);
  return out;
}

const junk = fc.oneof(
  fc.jsonValue({ maxDepth: 2 }),
  fc.constantFrom(
    -1,
    1.5,
    1e309,
    '',
    '__proto__',
    'constructor',
    null,
    [],
    {},
    'e0',
    10_000,
  ),
);

/** A document with 1–4 random edits: values replaced, keys deleted or added. */
const damaged = fc
  .tuple(
    seedDocument,
    fc.array(fc.tuple(fc.nat(), fc.nat(3), junk), {
      minLength: 1,
      maxLength: 4,
    }),
  )
  .map(([doc, edits]) => {
    const copy = structuredClone(doc);
    for (const [where, op, value] of edits) {
      const spots = places(copy);
      if (spots.length === 0) break;
      const [container, key] = spots[where % spots.length]!;
      if (op === 0) container[key] = value;
      else if (op === 1 && !Array.isArray(container)) delete container[key];
      else if (op === 1)
        (container as unknown as unknown[]).splice(Number(key), 1);
      else if (op === 2 && !Array.isArray(container))
        Object.defineProperty(
          container,
          ['extra', 'id', 'type', 'index', 'kind'][where % 5]!,
          {
            value,
            enumerable: true,
            configurable: true,
            writable: true,
          },
        );
      else container[key] = structuredClone(container[key]);
    }
    return copy;
  });

/** Splits `$.a[0]["b c"]` into keys. */
function keysOf(path: string): (string | number)[] {
  const keys: (string | number)[] = [];
  const re = /\.([A-Za-z_][A-Za-z0-9_]*)|\[(\d+)\]|\[("(?:[^"\\]|\\.)*")\]/y;
  if (!path.startsWith('$')) throw new Error(`unparseable path ${path}`);
  for (let at = 1; at < path.length;) {
    re.lastIndex = at;
    const m = re.exec(path);
    if (m === null) throw new Error(`unparseable path ${path}`);
    keys.push(
      m[1] ??
        (m[2] !== undefined ? Number(m[2]) : (JSON.parse(m[3]!) as string)),
    );
    at = re.lastIndex;
  }
  return keys;
}

/** Whether all but the last key of an error's path exist in the input. */
function pointsIntoInput(input: unknown, error: Diagnostic): boolean {
  const keys = keysOf(error.path);
  let node: unknown = input;
  for (const key of keys.slice(0, -1)) {
    if (typeof node !== 'object' || node === null || !Object.hasOwn(node, key))
      return false;
    node = (node as Record<PropertyKey, unknown>)[key];
  }
  return typeof node === 'object' || keys.length <= 1 || node !== undefined;
}

function checkLoad(input: unknown) {
  const parsed = parseVisualization(input);
  if (!parsed.ok) {
    expect(parsed.error.length).toBeGreaterThan(0);
    for (const e of parsed.error) {
      expect(typeof e.message).toBe('string');
      expect(pointsIntoInput(input, e), `${e.code} at ${e.path}`).toBe(true);
    }
    return;
  }
  // The canonical form is itself a valid input, and a fixed point.
  const again = parseVisualization(structuredClone(parsed.value));
  expect(again.ok ? again.value : again.error).toEqual(parsed.value);
  const loaded = loadTrace(input);
  if (!loaded.ok) {
    expect(loaded.error).toHaveLength(1);
    expect(
      pointsIntoInput(input, loaded.error[0]!),
      loaded.error[0]!.path,
    ).toBe(true);
    return;
  }
  const trace = loaded.value;
  const layout = layoutTrace(trace);
  for (const i of new Set([0, trace.length >> 1, trace.length]))
    expect(renderSvg(layout.sceneAt(i))).not.toMatch(/NaN|undefined|Infinity/);
}

describe('untrusted input', () => {
  it(
    'arbitrary JSON never throws',
    () => fc.assert(fc.property(fc.jsonValue(), checkLoad), params),
    600_000,
  );

  it(
    'damaged documents never throw, and errors point into them',
    () => fc.assert(fc.property(damaged, checkLoad), params),
    600_000,
  );

  it('the MCP tools never throw on arbitrary arguments', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...tools.map((t) => t.name)),
        fc.oneof(
          fc.jsonValue(),
          damaged.map((document) => ({ document })),
          damaged.map((document) => ({
            document: JSON.stringify(document),
            frames: [0, -1],
          })),
          fc.record({
            name: fc.string(),
            args: fc.dictionary(fc.string(), fc.jsonValue()),
          }),
        ),
        (name, args) => {
          const result = callTool(name, args);
          expect(typeof result.text).toBe('string');
        },
      ),
      params,
    );
  }, 600_000);
});
