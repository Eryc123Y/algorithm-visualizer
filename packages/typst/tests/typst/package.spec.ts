/**
 * The Typst package in Typst itself (ADR 0026): the `typst` command compiles
 * the examples and evaluates the package's functions, with the committed
 * plugin and an engine built from this checkout. Run with
 * `npm run test:typst`; it needs `typst` on PATH.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { algorithms, runAlgorithm } from '@algomotion/recipes';
import type { Diagnostic } from '@algomotion/spec';
import { exportFigures, themeNames } from '@algomotion/svg';

import { instantiatePlugin } from '../../scripts/host.ts';
import {
  examples,
  exported,
  frameworksMissing,
  installPackage,
  packageDir,
  spec,
  type Installed,
} from './install.ts';

let installed: Installed | undefined;
let tmp = '';
let root = '';

const typst = (args: readonly string[]) => installed!.typst(args);

/** Evaluates Typst code with the package imported. */
function run(code: string) {
  return typst(['eval', '--root', root, `{ import "${spec}": *; ${code} }`]);
}

/** The JSON value of Typst code with the package imported. */
function evaluate(code: string): unknown {
  const result = run(code);
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout) as unknown;
}

/** The error message Typst stops with. */
function failure(code: string): string {
  const result = run(code);
  expect(result.status).not.toBe(0);
  return result.stderr;
}

function documentOf(id: string, input: unknown): unknown {
  const run = runAlgorithm(id, input);
  if (!run.ok) throw new Error(JSON.stringify(run.error));
  return run.value.document;
}

beforeAll(async () => {
  installed = await installPackage();
  ({ tmp, root } = installed);
});

// A run stopped early may leave the directory in the system's tmpdir.
afterAll(() => installed?.remove());

describe('the examples', () => {
  const files = readdirSync(examples).filter((f) => f.endsWith('.typ'));
  // Slide decks need polylux or touying, which Typst may fail to download;
  // they are then skipped with the reason.
  const missing = frameworksMissing();
  const unavailable = (file: string) =>
    missing !== undefined && file.startsWith('slides-');

  it.for(files)('%s compiles without warnings', (file, ctx) => {
    if (unavailable(file)) ctx.skip(missing);
    const result = typst([
      'compile',
      '--root',
      examples,
      join(examples, file),
      join(tmp, `${file}.pdf`),
    ]);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('show figures, and errors only where they mean to', () => {
    const query = (file: string, code: string) =>
      JSON.parse(
        typst(['eval', '--root', examples, '--in', join(examples, file), code])
          .stdout,
      ) as unknown;
    const errors =
      'query(<algomotion-error>).map(m => m.value.map(d => d.code))';
    for (const file of files.filter(
      (f) => f !== 'errors.typ' && !unavailable(f),
    )) {
      expect(query(file, errors), file).toEqual([]);
      expect(query(file, 'query(image).len()'), file).toBeGreaterThan(1);
    }
    expect(query('errors.typ', errors)).toEqual([
      ['NO_MATCH'],
      ['INVALID_SHAPE'],
    ]);
  });
});

describe('figures in Typst', () => {
  it('are the SVG of exportFigures for every registry example', () => {
    const cases = algorithms
      .flatMap((a) => a.examples.map((input) => ({ algorithm: a.id, input })))
      // Every theme, spread over the examples.
      .map((c, k) => ({ ...c, theme: themeNames[k % themeNames.length]! }));
    expect(new Set(cases.map((c) => c.theme))).toEqual(new Set(themeNames));
    writeFileSync(join(root, 'cases.json'), JSON.stringify(cases));
    const svg = evaluate(
      'json("/cases.json").map(c => algomotion-figures(c.algorithm, c.input, theme: c.theme).figures.map(f => f.svg))',
    ) as string[][];
    expect(svg).toHaveLength(cases.length);
    cases.forEach((c, k) =>
      expect(svg[k], `${c.algorithm} in ${c.theme}`).toEqual(
        exported(documentOf(c.algorithm, c.input), [], c.theme),
      ),
    );
  });

  it('draw one step, of a run or of a document', () => {
    const input = { from: [8, 3, 10, 1, 6], key: 3 };
    const document = documentOf('bst.delete', input);
    writeFileSync(join(root, 'doc.json'), JSON.stringify(document));
    writeFileSync(join(root, 'input.json'), JSON.stringify(input));
    const [run, doc, last, alt] = evaluate(
      `(
        str(algomotion("bst.delete", json("/input.json"), step: 2, theme: "dark").source),
        str(algomotion(json("/doc.json"), step: "delete-3/no-left").source),
        str(algomotion("bst.delete", json("/input.json")).source),
        algomotion("bst.delete", json("/input.json"), step: 1).alt,
      )`,
    ) as string[];
    expect(run).toBe(exported(document, [2], 'dark')[0]);
    expect(doc).toBe(exported(document, ['delete-3/no-left'], 'light')[0]);
    expect(last).toBe(exported(document, [-1], 'light')[0]);
    const series = exportFigures(document, { steps: [1] });
    expect(series.ok && alt).toBe(
      series.ok ? series.value.figures[0]!.narration : undefined,
    );
  });

  it('take inputs in notations, as the main field alone, or none (ADR 0032)', () => {
    const graph = {
      nodes: ['A', 'B', 'C', 'D'],
      edges: [
        ['A', 'B', 4],
        ['B', 'C', 1],
        ['A', 'C', 7],
        ['C', 'D', 2],
      ],
    };
    const dijkstra = documentOf('dijkstra', { graph, source: 'A' });
    const sort = documentOf('insertion-sort', { values: [5, 2, 4, 6, 1, 3] });
    const bst = documentOf('bst', {
      from: [8, 3, 10, 1, 6],
      ops: [
        { op: 'insert', key: 4 },
        { op: 'delete', key: 3 },
      ],
    });
    const [notation, field, alone, ops, example] = evaluate(
      `(
        str(algomotion("dijkstra", "A-B 4, B-C 1, A-C 7, C-D 2", step: "improve#3").source),
        str(algomotion("dijkstra", (graph: "A-B 4, B-C 1, A-C 7, C-D 2", source: "A"), step: "improve#3").source),
        str(algomotion("insertion-sort", (5, 2, 4, 6, 1, 3), step: 4).source),
        str(algomotion("bst", (from: "8 3 10 1 6", ops: "insert 4, delete 3")).source),
        str(algomotion("dijkstra", step: 2).source),
      )`,
    ) as string[];
    expect(notation).toBe(exported(dijkstra, ['improve#3'], 'light')[0]);
    expect(field).toBe(notation);
    expect(alone).toBe(exported(sort, [4], 'light')[0]);
    expect(ops).toBe(exported(bst, [-1], 'light')[0]);
    expect(example).toBe(
      exported(documentOf('dijkstra', undefined), [2], 'light')[0],
    );
    expect(
      evaluate('algomotion-figures("dijkstra", "A-B 4, B-C x")'),
    ).toMatchObject({
      ok: false,
      diagnostics: [
        {
          code: 'INVALID_NOTATION',
          path: '$.input',
          message:
            'Expected a weight or "," after "B-C", not "x" (character 12)',
        },
      ],
    });
  });

  it('draw a series in timeline order, on one canvas', () => {
    const input = { from: [8, 3, 10, 1, 6], key: 3 };
    writeFileSync(join(root, 'input.json'), JSON.stringify(input));
    const svg = evaluate(
      'algomotion-series("bst.delete", json("/input.json"), steps: ("delete-3", 0, 1)).map(i => str(i.source))',
    ) as string[];
    const document = documentOf('bst.delete', input);
    expect(svg).toEqual(exported(document, ['delete-3', 0, 1], 'light'));
    expect(svg.length).toBeGreaterThan(2);
    const sizes = new Set(
      svg.map((s) => /width="([^"]+)" height="([^"]+)"/.exec(s)![0]),
    );
    expect(sizes.size).toBe(1);
  });
});

describe('layout (ADR 0029)', () => {
  // An array with a stack in the side panel.
  const sided = {
    version: '1.0',
    structures: {
      a: { kind: 'array', initial: [3, 1, 2] },
      calls: { kind: 'stack', initial: ['sort'], place: 'side' },
    },
    steps: [{ actions: [{ target: 'a', type: 'swap', i: 0, j: 1 }] }],
  };

  it('is narrow for notes by default, and takes "wide"', () => {
    writeFileSync(join(root, 'sided.json'), JSON.stringify(sided));
    const [one, wide, series, figures] = evaluate(
      `(
        str(algomotion(json("/sided.json")).source),
        str(algomotion(json("/sided.json"), layout: "wide").source),
        algomotion-series(json("/sided.json")).map(i => str(i.source)),
        algomotion-figures(json("/sided.json"), layout: "wide").figures.map(f => f.svg),
      )`,
    ) as [string, string, string[], string[]];
    expect(one).toBe(exported(sided, [-1], 'light', 'narrow')[0]);
    expect(wide).toBe(exported(sided, [-1], 'light', 'wide')[0]);
    expect(one).not.toBe(wide);
    expect(series).toEqual(exported(sided, [], 'light', 'narrow'));
    expect(figures).toEqual(exported(sided, [], 'light', 'wide'));
  });

  it('reports an unknown layout, and stops for one of the wrong type', () => {
    writeFileSync(join(root, 'sided.json'), JSON.stringify(sided));
    expect(
      evaluate('algomotion-figures(json("/sided.json"), layout: "square")'),
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'UNKNOWN_LAYOUT' }] });
    expect(failure('algomotion(json("/sided.json"), layout: 1)')).toContain(
      '`layout` takes "wide" or "narrow"',
    );
  });
});

describe('errors', () => {
  it('replace the figure with a box, or stop compilation when strict', () => {
    const doc = join(root, 'strict.typ');
    const call = `algomotion("dijkstra", (graph: (nodes: ("A", "B"), edges: (("A", "B", 1),)), source: "A"), step: "relax#2"`;
    writeFileSync(doc, `#import "${spec}": algomotion\n#${call})\n`);
    expect(
      typst(['compile', '--root', root, doc, join(tmp, 's.pdf')]).status,
    ).toBe(0);
    const boxes = typst([
      'eval',
      '--root',
      root,
      '--in',
      doc,
      'query(<algomotion-error>).map(m => m.value)',
    ]);
    const diagnostic = (JSON.parse(boxes.stdout) as Diagnostic[][])[0]?.[0];
    expect(diagnostic).toMatchObject({ code: 'NO_MATCH', path: '$' });
    expect(diagnostic!.hint).toContain('relax');

    writeFileSync(
      doc,
      `#import "${spec}": algomotion\n#${call}, strict: true)\n`,
    );
    const strict = typst(['compile', '--root', root, doc, join(tmp, 's.pdf')]);
    expect(strict.status).not.toBe(0);
    expect(strict.stderr).toContain('algomotion: NO_MATCH at $');
  });

  it('reject a step of several frames, which a series takes', () => {
    const doc = join(root, 'range.typ');
    const input = '(from: (8, 3, 10), key: 3)';
    writeFileSync(
      doc,
      `#import "${spec}": *\n#algomotion("bst.delete", ${input}, step: "1..2")\n#algomotion-series("bst.delete", ${input}, steps: "1..2").len()\n`,
    );
    const codes = typst([
      'eval',
      '--root',
      root,
      '--in',
      doc,
      'query(<algomotion-error>).map(m => m.value.map(d => d.code))',
    ]);
    expect(JSON.parse(codes.stdout)).toEqual([['INVALID_SELECTOR']]);
  });

  it('come back as data from algomotion-figures', () => {
    expect(evaluate('algomotion-figures("nope", (:))')).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'UNKNOWN_ALGORITHM' }],
    });
    expect(
      evaluate(
        'algomotion-figures("bst.delete", (from: (1,), key: 1), theme: "neon")',
      ),
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'UNKNOWN_THEME' }] });
  });

  it('stop compilation for arguments of the wrong type', () => {
    expect(failure('algomotion("dijkstra", (:), (:))')).toContain(
      'takes its input as the second argument',
    );
    expect(failure('algomotion("{}")')).toContain('json(');
    expect(failure('algomotion((:), (:))')).toContain(
      'a document takes no input',
    );
    expect(failure('algomotion(3)')).toContain('expected an algorithm id');
    expect(failure('algomotion("bst.delete", (:), theme: 3)')).toContain(
      '`theme` takes a name',
    );
    expect(failure('algomotion("bst.delete", (:), stpe: 1)')).toContain(
      'unexpected argument `stpe`',
    );
    expect(failure('algomotion("bst.delete", (:), step: 1.5)')).toContain(
      '`step` takes a frame number',
    );
    expect(
      failure('algomotion-series("bst.delete", (:), steps: (1, none))'),
    ).toContain('`steps` takes a frame number');
  });
});

describe('the plugin in wasmi', () => {
  it('stops deep recursion with a RangeError instead of trapping', async () => {
    const plugin = new Uint8Array(
      readFileSync(join(packageDir, 'plugin.wasm')),
    );
    const instance = await instantiatePlugin(plugin);
    const probe = `globalThis.renderRequest = (text) => {
      const f = (k) => (k === 0 ? 0 : 1 + f(k - 1));
      try { return String(f(JSON.parse(text))); } catch (e) { return String(e); }
    };`;
    writeFileSync(join(root, 'plugin.wasm'), plugin);
    writeFileSync(
      join(root, 'probe.bc'),
      instance.call('compile', new TextEncoder().encode(probe)),
    );
    const depth = (n: number) =>
      evaluate(
        `str(plugin.transition(plugin("/plugin.wasm").load, read("/probe.bc", encoding: none)).render(bytes("${n}")))`,
      );
    expect(depth(500)).toBe('500');
    expect(depth(5000)).toBe('RangeError: Maximum call stack size exceeded');
  });
});
