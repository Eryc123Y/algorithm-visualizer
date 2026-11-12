import { loadTrace } from '@algomotion/core';
import { algorithms, TOPICS } from '@algomotion/recipes';
import { describe, expect, it } from 'vitest';

import { inspect, formatInspect } from '../src/inspect.ts';
import { listRecipes, recipeCatalog, runRecipe } from '../src/recipes.ts';
import { render } from '../src/render.ts';
import { callTool, tools } from '../src/tools.ts';
import { formatReport, validate } from '../src/validate.ts';

const doc = {
  version: '1.0',
  structures: { a: { kind: 'array', initial: [3, 1, 2] } },
  steps: [
    {
      actions: [{ target: 'a', type: 'swap', i: 0, j: 1 }],
      meta: { narration: 'Swap 3 and 1.' },
    },
    {
      actions: [
        { target: 'a', type: 'swap', i: 1, j: 2 },
        { target: 'a', type: 'settle', index: 2 },
      ],
      meta: { narration: 'Swap 3 and 2; 3 is in place.' },
    },
  ],
};

describe('validate', () => {
  it('summarizes a valid document', () => {
    const report = validate(doc);
    expect(report).toEqual({
      valid: true,
      summary: {
        title: null,
        structures: [{ name: 'a', kind: 'array' }],
        steps: 2,
        frames: 3,
        sections: [],
      },
      warnings: [],
    });
    expect(formatReport(report)).toBe('Valid: a (array); 2 steps, frames 0–2.');
  });

  it('accepts JSON text', () => {
    expect(validate(JSON.stringify(doc)).valid).toBe(true);
  });

  it('reports JSON syntax errors', () => {
    const report = validate('{"version": ');
    expect(report.valid).toBe(false);
    if (report.valid) return;
    expect(report.errors[0]!.code).toBe('INVALID_JSON');
  });

  it('reports errors found while replaying, with their location', () => {
    const bad = structuredClone(doc);
    bad.steps[1]!.actions[0] = { target: 'a', type: 'swap', i: 1, j: 3 };
    const text = formatReport(validate(bad));
    expect(text).toBe(
      'Invalid: 1 error.\nOUT_OF_RANGE at $.steps[1].actions[0].j: j=3 is out of range for an array of length 3 (hint: Valid values are 0 to 2.)',
    );
  });

  it('lists at most 20 errors and counts the rest', () => {
    const bad = {
      ...doc,
      steps: Array.from({ length: 25 }, () => ({
        actions: [{ target: 'nope', type: 'swap', i: 0, j: 1 }],
      })),
    };
    const report = validate(bad);
    expect(report.valid).toBe(false);
    if (report.valid) return;
    expect(report.errors).toHaveLength(20);
    expect(report.errorCount).toBe(25);
    expect(formatReport(report)).toMatch(/…and 5 more$/);
  });

  it('warns about documents that teach less than they could', () => {
    const report = validate({
      version: '1.0',
      source: { code: 'x = 1' },
      structures: { a: { kind: 'array', initial: [1] } },
      steps: [
        { actions: [] },
        { actions: [{ target: 'a', type: 'settle', index: 0 }] },
      ],
    });
    expect(report.valid && report.warnings.map((w) => w.code)).toEqual([
      'NO_NARRATION',
      'UNUSED_SOURCE',
      'EMPTY_STEP',
    ]);
  });

  it('reads a 0.x document as 1.0, and says to write 1.0 (ADR 0043)', () => {
    const report = validate({ ...doc, version: '0.4' });
    expect(report.valid && report.warnings).toEqual([
      {
        code: 'UPGRADED_VERSION',
        path: '$.version',
        message: 'The document says version "0.4", which is read as "1.0"',
        hint: 'Set "version" to "1.0": the protocol is 1.0, which holds everything 0.x had.',
      },
    ]);
    // As JSON text too, as models pass documents.
    const text = validate(JSON.stringify({ ...doc, version: '0.9' }));
    expect(text.valid && text.warnings.map((w) => w.code)).toEqual([
      'UPGRADED_VERSION',
    ]);
  });

  it('warns about a document without steps', () => {
    const report = validate({ ...doc, steps: [] });
    expect(report.valid && report.warnings.map((w) => w.code)).toEqual([
      'NO_STEPS',
    ]);
  });
});

describe('inspect', () => {
  it('describes the last frame by default, without empty marks', () => {
    const report = inspect(doc);
    expect(report.ok && report.value).toEqual({
      frames: 3,
      described: [
        {
          frame: 2,
          narration: 'Swap 3 and 2; 3 is in place.',
          structures: {
            a: {
              kind: 'array',
              data: [
                { id: 'e1', value: 1 },
                { id: 'e2', value: 2 },
                { id: 'e0', value: 3 },
              ],
              marks: { swapped: [1, 2], settled: ['e0'] },
            },
          },
        },
      ],
    });
  });

  it('counts negative frames from the end', () => {
    const report = inspect(doc, [0, -2]);
    expect(report.ok && report.value.described.map((f) => f.frame)).toEqual([
      0, 1,
    ]);
  });

  it('rejects frames that do not exist', () => {
    const report = inspect(doc, [3]);
    expect(report.ok).toBe(false);
    if (report.ok) return;
    expect(report.error[0]!.hint).toContain('0 (before the first step) to 2');
  });

  it('formats one block per frame', () => {
    const report = inspect(doc, [0]);
    expect(report.ok && formatInspect(report.value)).toBe(
      'Frame 0 of 0–2\na: {"kind":"array","data":[{"id":"e0","value":3},{"id":"e1","value":1},{"id":"e2","value":2}]}',
    );
  });
});

describe('render', () => {
  it('draws the last frame as SVG', () => {
    const result = render(doc);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.frame).toBe(2);
    expect(result.value.svg).toMatch(/^<svg [^>]*viewBox/);
    expect(result.value.svg).not.toContain('data-key');
  });

  it('draws with the dark theme', () => {
    const light = render(doc);
    const dark = render(doc, { theme: 'dark' });
    expect(light.ok && dark.ok && light.value.svg !== dark.value.svg).toBe(
      true,
    );
  });
});

describe('recipes', () => {
  it('has unique ids, grouped by topic', () => {
    const ids = recipeCatalog.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const topics = recipeCatalog.map((r) => TOPICS.indexOf(r.topic));
    expect(topics).toEqual([...topics].sort((x, y) => x - y));
  });

  it('lists every registry module with its input as JSON Schema', () => {
    const listed = listRecipes();
    for (const { id } of algorithms)
      expect(listed.map((r) => r.id)).toContain(id);
    const remove = listed.find((r) => r.id === 'bst.delete')!;
    expect(remove).toMatchObject({
      title: 'Binary search tree: delete',
      topic: 'trees',
      input: {
        type: 'object',
        required: ['from', 'key'],
        properties: { replaceWith: { enum: ['successor', 'predecessor'] } },
      },
    });
    expect(remove.summary).toMatch(/\.$/);
  });

  it('builds valid documents', () => {
    const doc = runRecipe('dijkstra', {
      graph: {
        nodes: ['A', 'B', 'C'],
        edges: [
          ['A', 'B', 2],
          ['B', 'C', 1],
        ],
      },
      source: 'A',
    });
    expect(doc.ok && loadTrace(doc.value).ok).toBe(true);
  });

  it('checks inputs against the schema, at paths under $.input', () => {
    for (const [id, input, code, path] of [
      ['bubble-sort', { values: 'nope' }, 'INVALID_NOTATION', '$.input.values'],
      [
        'binary-search',
        { values: [1, 'x'], target: 1 },
        'INVALID_SHAPE',
        '$.input.values[1]',
      ],
      ['bst.search', { from: [1], key: 'x' }, 'INVALID_SHAPE', '$.input.key'],
    ] as const) {
      const doc = runRecipe(id, input);
      expect(!doc.ok && doc.error[0]).toMatchObject({ code, path });
    }
  });

  it('reports inputs the recipe cannot show', () => {
    const doc = runRecipe('dijkstra', {
      graph: { nodes: ['A', 'B'], edges: [['A', 'B', -1]] },
      source: 'A',
    });
    expect(!doc.ok && doc.error[0]).toMatchObject({
      code: 'INVALID_ARGUMENT',
      path: '$.input',
    });
  });

  it('runs operations on a given BST or heap', () => {
    const bst = runRecipe('bst', {
      from: [8, 3, 10, 1, 6],
      ops: [
        { op: 'delete', key: 3 },
        { op: 'search', key: 6 },
      ],
    });
    expect(bst.ok && loadTrace(bst.value).ok).toBe(true);
    expect(bst.ok && bst.value.title).toBe(
      'Binary search tree: delete 3, search 6',
    );
    const heap = runRecipe('max-heap', {
      from: { array: [9, 5, 7] },
      ops: [{ op: 'increase-key', index: 2, value: 10 }, { op: 'pop' }],
    });
    expect(heap.ok && loadTrace(heap.value).ok).toBe(true);
    const one = runRecipe('min-heap.pop', { from: [3, 1, 2] });
    expect(one.ok && one.value.title).toBe('Binary min-heap: pop');
  });

  it('rejects operations the schema or the state does not allow', () => {
    const unknown = runRecipe('bst', { from: [1], ops: [{ op: 'rotate' }] });
    expect(!unknown.ok && unknown.error[0]).toMatchObject({
      code: 'INVALID_SHAPE',
      path: '$.input.ops[0].op',
      message: 'Unknown operation; use search, insert or delete',
    });
    const tooMany = runRecipe('min-heap', {
      from: [1],
      ops: Array.from({ length: 9 }, () => ({ op: 'pop' })),
    });
    expect(!tooMany.ok && tooMany.error[0]!.path).toBe('$.input.ops');
    const empty = runRecipe('min-heap.pop', { from: [] });
    expect(!empty.ok && empty.error[0]).toMatchObject({
      code: 'INVALID_ARGUMENT',
      message: 'The heap is empty: there is nothing to pop',
    });
  });

  it('reports unknown recipes', () => {
    const doc = runRecipe('bogosort', {});
    expect(!doc.ok && doc.error[0]).toMatchObject({
      code: 'UNKNOWN_RECIPE',
      path: '$.id',
    });
  });
});

describe('tools', () => {
  it('have unique, prefixed names', () => {
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^algomotion_[a-z_]+$/);
  });

  it('check arguments before running', () => {
    const result = callTool('algomotion_inspect', {
      document: doc,
      frames: 'last',
    });
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/^Invalid arguments/);
  });

  it('mark invalid documents as errors', () => {
    expect(callTool('algomotion_validate', { document: {} }).isError).toBe(
      true,
    );
    expect(callTool('algomotion_validate', { document: doc }).isError).toBe(
      false,
    );
  });

  it('return recipe documents as JSON', () => {
    const result = callTool('algomotion_run_recipe', {
      id: 'binary-search',
      input: { values: [1, 3, 5], target: 3 },
    });
    expect(validate(result.text).valid).toBe(true);
  });

  it('let the recipe check its input, whatever JSON it is', () => {
    for (const input of [[1, 2], 3, null]) {
      const result = callTool('algomotion_run_recipe', { id: 'bst', input });
      expect(result.isError).toBe(true);
      expect(result.text).toMatch(/^INVALID_SHAPE at \$\.input/);
    }
  });

  it('reject unknown tools', () => {
    expect(callTool('nope', {}).isError).toBe(true);
  });
});
