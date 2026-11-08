/**
 * `algoviz-slides` (ADR 0028): a series as one box whose frames show on
 * consecutive subslides through the slide framework's own `only`. A
 * stand-in `only` records what each frame gets; decks with polylux 0.4.0
 * and touying 0.8.0 show that each page draws its frame's SVG. Run with
 * `npm run test:typst`; the deck tests need Typst to download the
 * frameworks once, and are skipped with a message when it cannot.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runAlgorithm } from '@algoviz/recipes';

import {
  examples,
  exported,
  frameworksMissing,
  installPackage,
  spec,
  type Installed,
} from './install.ts';

let installed: Installed | undefined;
const typst = (args: readonly string[]) => installed!.typst(args);

beforeAll(async () => {
  installed = await installPackage();
});

afterAll(() => installed?.remove());

/** The JSON value of Typst code with the package imported. */
function evaluate(code: string): unknown {
  const result = typst([
    'eval',
    '--root',
    installed!.root,
    `{ import "${spec}": *; ${code} }`,
  ]);
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout) as unknown;
}

/** The error message Typst stops with. */
function failure(code: string): string {
  const result = typst([
    'eval',
    '--root',
    installed!.root,
    `{ import "${spec}": *; ${code} }`,
  ]);
  expect(result.status).not.toBe(0);
  return result.stderr;
}

function documentOf(id: string, input: unknown): unknown {
  const run = runAlgorithm(id, input);
  if (!run.ok) throw new Error(JSON.stringify(run.error));
  return run.value.document;
}

const bstInput = { from: [8, 3, 10, 1, 6], key: 3 };
const BST = '(from: (8, 3, 10, 1, 6), key: 3)';

/**
 * What `algoviz-slides` returns with a stand-in `only` that records the
 * subslides and the image it gets: the box's children, each a hidden
 * image, a placed frame or another element.
 */
interface Part {
  readonly kind: 'hidden' | 'frame' | 'image' | 'other';
  readonly subslides?: number | string;
  readonly svg?: string;
  readonly alt?: string | null;
  readonly width?: string;
}

const STAND_IN = `
  let only(subslides, body) = metadata((subslides: subslides, svg: str(body.source), alt: body.alt, width: repr(body.width)));
  let part(c) = if c.func() == hide {
    (kind: "hidden", svg: str(c.body.source), alt: c.body.alt, width: repr(c.body.width))
  } else if c.func() == place {
    (kind: "frame", ..c.body.value)
  } else if c.func() == image {
    (kind: "image", svg: str(c.source), alt: c.alt)
  } else { (kind: "other", name: repr(c.func())) };
  let parts(r) = if r.func() == box { r.body.children.map(part) } else { (part(r),) };
`;

const slides = (args: string): Part[] =>
  evaluate(`${STAND_IN} parts(algoviz-slides(only, ${args}))`) as Part[];

describe('algoviz-slides with a stand-in only', () => {
  it('gives frame k subslide start + k − 1, and the last one its subslide on', () => {
    const parts = slides(`"bst.delete", ${BST}, steps: (0, 1, -1)`);
    const document = documentOf('bst.delete', bstInput);
    const svg = exported(document, [0, 1, -1], 'light', 'wide');
    expect(parts.map((p) => p.kind)).toEqual([
      'hidden',
      'frame',
      'frame',
      'frame',
    ]);
    expect(parts.slice(1).map((p) => p.subslides)).toEqual([1, 2, '3-']);
    expect(parts.slice(1).map((p) => p.svg)).toEqual(svg);
    // The hidden copy of the first frame sizes the box, and is not read out.
    expect(parts[0]).toMatchObject({ svg: svg[0], alt: null });
  });

  it('starts at start, and takes the steps of algoviz-series', () => {
    const parts = slides(`"bst.delete", ${BST}, steps: "delete-3", start: 3`);
    const document = documentOf('bst.delete', bstInput);
    const svg = exported(document, ['delete-3'], 'light', 'wide');
    const frames = parts.filter((p) => p.kind === 'frame');
    expect(frames.map((p) => p.svg)).toEqual(svg);
    expect(frames.map((p) => p.subslides)).toEqual([
      ...svg.slice(1).map((_, k) => 3 + k),
      `${3 + svg.length - 1}-`,
    ]);
  });

  it('draws every frame by default, with its narration and the sizes given', () => {
    const parts = slides(`"bst.delete", ${BST}, theme: "print", width: 40%`);
    const document = documentOf('bst.delete', bstInput);
    const svg = exported(document, [], 'print', 'wide');
    const frames = parts.filter((p) => p.kind === 'frame');
    expect(frames.map((p) => p.svg)).toEqual(svg);
    // Typst keeps 40% as a relative length, 40% + 0pt.
    expect(new Set(parts.map((p) => p.width))).toEqual(new Set(['40% + 0pt']));
    const run = runAlgorithm('bst.delete', bstInput);
    if (!run.ok) throw new Error('bst.delete');
    expect(frames[1]!.alt).toBe(run.value.document.steps[0]!.meta?.narration);
  });

  it('draws wide by default, as slides have room, and takes layout', () => {
    // An array with a stack in the side panel (ADR 0029).
    const sided = {
      version: '0.4',
      structures: {
        a: { kind: 'array', initial: [3, 1, 2] },
        calls: { kind: 'stack', initial: ['sort'], place: 'side' },
      },
      steps: [{ actions: [{ target: 'a', type: 'swap', i: 0, j: 1 }] }],
    };
    writeFileSync(join(installed!.root, 'sided.json'), JSON.stringify(sided));
    const frames = (args: string) =>
      slides(args)
        .filter((p) => p.kind === 'frame')
        .map((p) => p.svg);
    expect(frames('json("/sided.json")')).toEqual(
      exported(sided, [], 'light', 'wide'),
    );
    expect(frames('json("/sided.json"), layout: "narrow"')).toEqual(
      exported(sided, [], 'light', 'narrow'),
    );
  });

  it('draws a series of one frame as its image, on every subslide', () => {
    const parts = slides(`"bst.delete", ${BST}, steps: "delete-3/copy"`);
    const document = documentOf('bst.delete', bstInput);
    expect(parts).toEqual([
      {
        kind: 'image',
        svg: exported(document, ['delete-3/copy'], 'light', 'wide')[0],
        alt: expect.any(String) as string,
      },
    ]);
  });

  it('shows an error in a box, or stops when strict', () => {
    const doc = join(installed!.root, 'slides-error.typ');
    writeFileSync(
      doc,
      `#import "${spec}": *\n#algoviz-slides((s, b) => b, "bst.delete", ${BST}, steps: "nope")\n`,
    );
    const codes = typst([
      'eval',
      '--root',
      installed!.root,
      '--in',
      doc,
      'query(<algoviz-error>).map(m => m.value.map(d => d.code))',
    ]);
    expect(JSON.parse(codes.stdout)).toEqual([['NO_MATCH']]);
    expect(
      failure(
        `algoviz-slides((s, b) => b, "bst.delete", ${BST}, steps: "nope", strict: true)`,
      ),
    ).toContain('algoviz-slides: NO_MATCH at $');
  });

  it('stops compilation for arguments of the wrong type', () => {
    expect(failure(`algoviz-slides("bst.delete", ${BST})`)).toContain(
      "algoviz-slides: the first argument is the slide framework's `only`",
    );
    expect(
      failure(`algoviz-slides((s, b) => b, "bst.delete", ${BST}, start: 0)`),
    ).toContain('`start` takes a subslide number from 1');
    expect(
      failure(`algoviz-slides((s, b) => b, "bst.delete", ${BST}, start: "2")`),
    ).toContain('`start` takes a subslide number from 1');
    expect(
      failure(`algoviz-slides((s, b) => b, "bst.delete", ${BST}, steps: 1.5)`),
    ).toContain('`steps` takes a frame number');
  });
});

/**
 * The SVG images each page of a compiled deck draws, in page order: Typst
 * embeds an SVG image as its own text, in base64.
 */
function pagesOf(file: string, dir = examples): string[][] {
  const out = join(installed!.tmp, file.replace(/\.typ$/, ''));
  const result = typst([
    'compile',
    '--root',
    dir,
    join(dir, file),
    `${out}-{0p}.svg`,
  ]);
  if (result.status !== 0) throw new Error(result.stderr);
  const base = out.split('/').at(-1)!;
  return readdirSync(installed!.tmp)
    .filter((f) => f.startsWith(`${base}-`) && f.endsWith('.svg'))
    .toSorted()
    .map((f) =>
      [
        ...readFileSync(join(installed!.tmp, f), 'utf8').matchAll(
          /data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)/g,
        ),
      ].map((m) => Buffer.from(m[1]!, 'base64').toString('utf8')),
    );
}

// Why the frameworks cannot be loaded, if they cannot: each deck test is
// then skipped with this message.
const missing = frameworksMissing();

describe('decks', () => {
  const input = {
    graph: {
      nodes: ['s', 'a', 'b', 'c', 't'],
      edges: [
        ['s', 'a', 4],
        ['s', 'b', 1],
        ['b', 'a', 2],
        ['a', 'c', 1],
        ['b', 'c', 5],
        ['c', 't', 3],
      ],
    },
    source: 's',
  };
  const dijkstra = documentOf('dijkstra', input);
  const bst = documentOf('bst.delete', {
    from: [8, 3, 10, 1, 6, 4, 7],
    key: 3,
  });
  // Every frame of Dijkstra; the range on the second subslide, after a
  // subslide with the text alone; a section in the print theme.
  const expected = [
    ...exported(dijkstra, [], 'light', 'wide').map((svg) => [svg]),
    [],
    ...exported(dijkstra, ['extract#3..improve#5'], 'light', 'wide').map(
      (svg) => [svg],
    ),
    ...exported(bst, ['delete-3'], 'print', 'wide').map((svg) => [svg]),
  ];

  it.for(['slides-polylux.typ', 'slides-touying.typ'])(
    '%s draws one frame per subslide',
    (file, ctx) => {
      if (missing !== undefined) ctx.skip(missing);
      const pages = pagesOf(file);
      expect(pages.length).toBe(expected.length);
      pages.forEach((page, k) =>
        expect(page, `page ${k + 1}`).toEqual(expected[k]),
      );
    },
  );

  it("keeps the last frame in touying's handout mode", (ctx) => {
    if (missing !== undefined) ctx.skip(missing);
    const deck = readFileSync(
      join(examples, 'slides-touying.typ'),
      'utf8',
    ).replace(
      'simple-theme.with(aspect-ratio: "16-9")',
      'simple-theme.with(aspect-ratio: "16-9", config-common(handout: true))',
    );
    expect(deck).toContain('handout: true');
    writeFileSync(join(installed!.root, 'handout.typ'), deck);
    expect(pagesOf('handout.typ', installed!.root)).toEqual([
      [exported(dijkstra, [-1], 'light', 'wide')[0]],
      [exported(dijkstra, ['improve#5'], 'light', 'wide')[0]],
      [exported(bst, [-1], 'print', 'wide')[0]],
    ]);
  });
});
