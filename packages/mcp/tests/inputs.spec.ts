/**
 * Algorithms and their inputs in the CLI and the MCP tools (ADR 0032):
 * notations, the main field alone, no input, and recipes by name in the
 * tools that draw.
 */
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { findAlgorithm, runAlgorithm } from '@algomotion/recipes';

import { main } from '../src/cli.ts';
import { show, showSource } from '../src/show.ts';
import { callTool, listRecipes } from '../src/index.ts';

const dir = mkdtempSync(join(tmpdir(), 'algomotion-inputs-'));
let outs = 0;
const outDir = () => join(dir, `out-${++outs}`);

function run(...argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = main(
    argv,
    (t) => out.push(t),
    (t) => err.push(t),
  );
  return { code, out: out.join('\n'), err: err.join('\n') };
}

const GRAPH = 'A-B 4, B-C 1, A-C 7, C-D 2';
const STRUCTURED = {
  graph: {
    nodes: ['A', 'B', 'C', 'D'],
    edges: [
      ['A', 'B', 4],
      ['B', 'C', 1],
      ['A', 'C', 7],
      ['C', 'D', 2],
    ],
  },
  source: 'A',
};

function documentOf(id: string, input?: unknown) {
  const result = runAlgorithm(id, input);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value.document;
}

const hex = (text: string) => Buffer.from(text, 'utf8').toString('hex');

describe('algomotion run', () => {
  it('takes a notation, the main field alone', () => {
    const { code, out } = run('run', 'dijkstra', GRAPH);
    expect(code).toBe(0);
    expect(JSON.parse(out)).toEqual(documentOf('dijkstra', STRUCTURED));
  });

  it('takes an object without its braces', () => {
    const { code, out } = run(
      'run',
      'dijkstra',
      `"graph": "${GRAPH}", "source": "B"`,
    );
    expect(code).toBe(0);
    expect(JSON.parse(out)).toEqual(
      documentOf('dijkstra', { ...STRUCTURED, source: 'B' }),
    );
  });

  it('runs the first example without an input', () => {
    const { code, out } = run('run', 'insertion-sort');
    expect(code).toBe(0);
    expect(JSON.parse(out)).toEqual(
      documentOf(
        'insertion-sort',
        findAlgorithm('insertion-sort')!.examples[0],
      ),
    );
  });

  it('reports broken JSON and a notation error, with exit code 1', () => {
    const json = run('run', 'bst', '{oops');
    expect(json.code).toBe(1);
    expect(json.err).toMatch(/^INVALID_JSON at \$\.input/);
    const notation = run('run', 'insertion-sort', '5 x 4');
    expect(notation.code).toBe(1);
    expect(notation.err).toContain(
      'INVALID_NOTATION at $.input: Expected a number, not "x" (character 3)',
    );
  });

  it('still needs an id', () => {
    expect(run('run').code).toBe(2);
  });
});

describe('algomotion export --input', () => {
  const frames = (out: string) => readdirSync(out).length;

  it('takes a notation, as text or in a file', () => {
    const text = outDir();
    expect(
      run('export', 'bfs', '--input', 'A-B, A-C, B-D', '--out', text).code,
    ).toBe(0);
    const file = join(dir, 'graph.txt');
    writeFileSync(file, 'A-B\nA-C\nB-D\n');
    const fromFile = outDir();
    expect(run('export', 'bfs', '--input', file, '--out', fromFile).code).toBe(
      0,
    );
    expect(frames(fromFile)).toBe(frames(text));
    const [first] = readdirSync(text);
    expect(readFileSync(join(fromFile, first!), 'utf8')).toBe(
      readFileSync(join(text, first!), 'utf8'),
    );
  });

  it('takes a notation and an empty input as hexadecimal UTF-8, as LaTeX passes them', () => {
    const out = outDir();
    expect(
      run('export', 'dijkstra', `--input-hex=${hex(GRAPH)}`, '--out', out).code,
    ).toBe(0);
    const example = outDir();
    expect(
      run('export', 'dijkstra', '--input-hex=', '--out', example).code,
    ).toBe(0);
    expect(frames(example)).toBe(
      documentOf('dijkstra', undefined).steps.length + 1,
    );
  });

  it('reports a missing .json file as unreadable, and broken JSON as an error', () => {
    const missing = run(
      'export',
      'dijkstra',
      '--input',
      join(dir, 'missing.json'),
    );
    expect(missing.code).toBe(2);
    expect(missing.err).toContain('Cannot read');
    const broken = run(
      'export',
      'dijkstra',
      '--input',
      '{oops',
      '--out',
      outDir(),
    );
    expect(broken.code).toBe(1);
    expect(broken.err).toContain('INVALID_JSON');
    const brokenHex = run(
      'export',
      'dijkstra',
      `--input-hex=${hex('{oops')}`,
      '--out',
      outDir(),
    );
    expect(brokenHex.code).toBe(1);
    expect(brokenHex.err).toContain('INVALID_JSON');
  });
});

describe('the MCP tools', () => {
  it('run a recipe on a notation, or on its first example', () => {
    const run = callTool('algomotion_run_recipe', {
      id: 'dijkstra',
      input: GRAPH,
    });
    expect(run.isError).toBeFalsy();
    expect(JSON.parse(run.text)).toEqual(documentOf('dijkstra', STRUCTURED));
    const example = callTool('algomotion_run_recipe', { id: 'dijkstra' });
    expect(JSON.parse(example.text)).toEqual(documentOf('dijkstra'));
  });

  it('render and inspect a recipe by name', () => {
    const byName = callTool('algomotion_render', {
      recipe: 'dijkstra',
      input: GRAPH,
      frame: 'improve#1',
    });
    const byDocument = callTool('algomotion_render', {
      document: documentOf('dijkstra', STRUCTURED),
      frame: 'improve#1',
    });
    expect(byName.isError).toBeFalsy();
    expect(byName.text).toBe(byDocument.text);
    const inspected = callTool('algomotion_inspect', {
      recipe: 'insertion-sort',
      input: '3 1 2',
    });
    expect(inspected.isError).toBeFalsy();
    expect(inspected.text).toContain('Frame');
  });

  it('take a document or a recipe, not both and not neither', () => {
    const doc = documentOf('insertion-sort');
    expect(
      callTool('algomotion_render', { document: doc, recipe: 'dijkstra' }).text,
    ).toContain('not both');
    expect(callTool('algomotion_render', {}).text).toContain('Give a document');
    expect(
      callTool('algomotion_render', { document: doc, input: '3 1' }).text,
    ).toContain('goes with a recipe');
  });

  it('report an input error of a recipe at its token', () => {
    const result = callTool('algomotion_render', {
      recipe: 'dijkstra',
      input: 'A-B x',
    });
    expect(result.isError).toBe(true);
    expect(result.text).toContain('INVALID_NOTATION at $.input');
    expect(result.text).toContain('"x"');
  });

  it('show a recipe by name, with its frame', () => {
    const shown = showSource({ recipe: 'dijkstra', input: GRAPH }, 'improve#1');
    expect(shown.ok).toBe(true);
    expect(shown).toEqual(
      show(documentOf('dijkstra', STRUCTURED), 'improve#1'),
    );
    if (shown.ok) expect(shown.content.frame).toBeGreaterThan(0);
    expect(showSource({ recipe: 'nope' }).ok).toBe(false);
  });

  it('list each input with its notation first', () => {
    const recipes = listRecipes();
    const schema = (id: string) =>
      recipes.find((r) => r.id === id)!.input as z.core.JSONSchema.BaseSchema;
    const sort = schema('insertion-sort');
    const values = (sort.anyOf![0] as z.core.JSONSchema.BaseSchema).properties![
      'values'
    ] as z.core.JSONSchema.BaseSchema;
    expect((values.anyOf![0] as z.core.JSONSchema.BaseSchema).type).toBe(
      'string',
    );
    expect(JSON.stringify(schema('dijkstra'))).toContain('A-B 4, B-C 2');
    expect(JSON.stringify(schema('bst'))).toContain('insert 4');
  });
});
