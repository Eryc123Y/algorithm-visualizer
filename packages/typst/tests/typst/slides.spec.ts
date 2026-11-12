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
import { themeNames } from '@algoviz/svg';

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
 * image, a placed frame or another element. A frame sizes itself with
 * `layout` (ADR 0033); the stand-in calls it with the region given.
 */
interface Part {
  readonly kind: 'hidden' | 'frame' | 'image' | 'other';
  readonly subslides?: number | string;
  readonly svg?: string;
  readonly alt?: string | null;
  /** The image's size in points, or "auto" for its natural size. */
  readonly width?: number | string;
  readonly height?: number | string;
}

const standIn = (region: string) => `
  let region = ${region};
  let drawn(c) = if repr(c.func()) == "layout" { (c.fields().func)(region) } else { c };
  let side(v) = if type(v) == length { v.pt() } else if type(v) == relative and v.ratio == 0% { v.length.pt() } else { repr(v) };
  let shown(c) = { let i = drawn(c); (svg: str(i.source), alt: i.alt, width: side(i.width), height: side(i.height)) };
  let only(subslides, body) = metadata((subslides: subslides, ..shown(body)));
  let part(c) = if c.func() == hide {
    (kind: "hidden", ..shown(c.body))
  } else if c.func() == place {
    (kind: "frame", ..c.body.value)
  } else if c.func() == image or repr(c.func()) == "layout" {
    let i = shown(c);
    (kind: "image", svg: i.svg, alt: i.alt, width: i.width, height: i.height)
  } else { (kind: "other", name: repr(c.func())) };
  let parts(r) = if r.func() == box { r.body.children.map(part) } else { (part(r),) };
`;

/** The parts of `algoviz-slides(…)` laid out in an 800 by 400 pt region. */
const slides = (
  args: string,
  region = '(width: 800pt, height: 400pt)',
): Part[] =>
  evaluate(`${standIn(region)} parts(algoviz-slides(only, ${args}))`) as Part[];

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

  it('draws every frame by default, with its narration, all at one size', () => {
    const parts = slides(`"bst.delete", ${BST}, theme: "print", width: 40%`);
    const document = documentOf('bst.delete', bstInput);
    const svg = exported(document, [], 'print', 'wide');
    const frames = parts.filter((p) => p.kind === 'frame');
    expect(frames.map((p) => p.svg)).toEqual(svg);
    expect(new Set(parts.map((p) => p.width)).size).toBe(1);
    expect(new Set(parts.map((p) => p.height)).size).toBe(1);
    const run = runAlgorithm('bst.delete', bstInput);
    if (!run.ok) throw new Error('bst.delete');
    expect(frames[1]!.alt).toBe(run.value.document.steps[0]!.meta?.narration);
  });

  it('draws in every built-in theme (ADR 0030)', () => {
    const document = documentOf('bst.delete', bstInput);
    for (const theme of themeNames) {
      const frames = slides(
        `"bst.delete", ${BST}, steps: (0, -1), theme: "${theme}"`,
      ).filter((p) => p.kind === 'frame');
      expect(
        frames.map((p) => p.svg),
        theme,
      ).toEqual(exported(document, [0, -1], theme, 'wide'));
    }
  });

  it('draws wide by default, as slides have room, and takes layout', () => {
    // An array with a stack in the side panel (ADR 0029).
    const sided = {
      version: '1.0',
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
    expect(parts).toMatchObject([
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

/** The canvas of a registry example's last frame, in the wide layout. */
function canvasOf(id: string): { width: number; height: number } {
  return evaluate(
    `algoviz-figures("${id}", steps: -1, layout: "wide").figures.first()`,
  ) as { width: number; height: number };
}

const TOLERANCE = 0.01;

/**
 * An image fits the box w by h, touches one of its sides and keeps the
 * canvas's shape.
 */
function expectFilled(
  image: { width?: number | string; height?: number | string },
  canvas: { width: number; height: number },
  w: number,
  h: number,
  label: string,
) {
  const width = image.width as number;
  const height = image.height as number;
  expect(width, label).toBeLessThanOrEqual(w + TOLERANCE);
  expect(height, label).toBeLessThanOrEqual(h + TOLERANCE);
  expect(
    Math.min(Math.abs(width - w), Math.abs(height - h)),
    `${label} touches a side`,
  ).toBeLessThan(TOLERANCE);
  expect(width / height, `${label} keeps its shape`).toBeCloseTo(
    canvas.width / canvas.height,
    4,
  );
}

describe('algoviz-slides sizes (ADR 0033)', () => {
  const ids = ['kruskal', 'dijkstra', 'binary-search'];
  let canvases: Record<string, { width: number; height: number }> = {};
  beforeAll(() => {
    canvases = Object.fromEntries(ids.map((id) => [id, canvasOf(id)]));
  });
  const sized = (id: string, args = '', region?: string) =>
    slides(`"${id}", steps: (0, -1)${args}`, region).filter(
      (p) => p.kind !== 'other',
    );

  it('fills the width and three quarters of the height, every frame alike', () => {
    for (const id of ids) {
      const parts = sized(id);
      expect(parts).toHaveLength(3);
      for (const part of parts) expectFilled(part, canvases[id]!, 800, 300, id);
    }
    // Dijkstra and binary search are bound by the height, and binary search
    // grows past its natural 0.75 pt per pixel. Kruskal, two and a half
    // times as wide as it is tall, is bound by the width of a squarer
    // region.
    expect(
      sized('kruskal', '', '(width: 400pt, height: 400pt)')[0]!.width,
    ).toBeCloseTo(400, 2);
    expect(sized('dijkstra')[0]!.height).toBeCloseTo(300, 2);
    expect(sized('binary-search')[0]!.width as number).toBeGreaterThan(
      1.5 * 0.75 * canvases['binary-search']!.width,
    );
  });

  it('takes width and height as sides of the box', () => {
    const cases: [string, string, number, number][] = [
      ['kruskal', 'height: 50%', 800, 200],
      ['binary-search', 'height: 50%', 800, 200],
      ['dijkstra', 'width: 40%', 320, 300],
      ['binary-search', 'width: 100% - 100pt', 700, 300],
      ['dijkstra', 'width: 300pt, height: 300pt', 300, 300],
      ['binary-search', 'height: 25% + 50pt', 800, 150],
    ];
    for (const [id, args, w, h] of cases)
      for (const part of sized(id, `, ${args}`))
        expectFilled(part, canvases[id]!, w, h, `${id}, ${args}`);
  });

  it('makes cover and stretch the box itself', () => {
    for (const fit of ['cover', 'stretch'])
      for (const part of sized('dijkstra', `, fit: "${fit}"`))
        expect([part.width, part.height], fit).toEqual([800, 300]);
  });

  it('takes 0% of an unbounded side as nothing', () => {
    for (const part of sized(
      'dijkstra',
      ', height: 0%',
      '(width: 800pt, height: float.inf * 1pt)',
    ))
      expect([part.width, part.height]).toEqual([0, 0]);
  });

  it('lets an unbounded side go, and keeps the natural size when both are', () => {
    for (const part of sized(
      'dijkstra',
      '',
      '(width: 800pt, height: float.inf * 1pt)',
    ))
      expect(part.width).toBeCloseTo(800, 2);
    for (const part of sized(
      'dijkstra',
      '',
      '(width: float.inf * 1pt, height: float.inf * 1pt)',
    ))
      expect([part.width, part.height]).toEqual(['auto', 'auto']);
  });

  it('sizes a series of one frame the same way', () => {
    const [part] = slides('"binary-search", steps: -1');
    expect(part!.kind).toBe('image');
    expectFilled(part!, canvases['binary-search']!, 800, 300, 'one frame');
  });

  it('stops compilation for a size of the wrong type', () => {
    expect(
      failure(`algoviz-slides((s, b) => b, "binary-search", width: 1fr)`),
    ).toContain('algoviz-slides: `width` takes a length or a ratio');
    expect(
      failure(`algoviz-slides((s, b) => b, "binary-search", height: "big")`),
    ).toContain('algoviz-slides: `height` takes a length or a ratio');
  });
});

/**
 * The SVG images each page of a compiled deck draws, in page order: Typst
 * embeds an SVG image as its own text, in base64.
 */
function pagesOf(file: string, dir = examples): string[][] {
  return pageSvgs(file, dir).map((page) =>
    [...page.matchAll(/data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)/g)].map(
      (m) => Buffer.from(m[1]!, 'base64').toString('utf8'),
    ),
  );
}

/** Each page of a compiled deck as SVG, in page order. */
function pageSvgs(file: string, dir: string): string[] {
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
    .map((f) => readFileSync(join(installed!.tmp, f), 'utf8'));
}

/** The size in points of each image a page draws. */
const imageSizes = (page: string) =>
  [...page.matchAll(/<image [^>]*width="([\d.]+)" height="([\d.]+)"/g)].map(
    (m) => ({ width: Number(m[1]), height: Number(m[2]) }),
  );

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

  // A slide per figure, each logging the region its figure fills.
  const filling = {
    'polylux.typ': (figure: string) =>
      `#slide[\n  == A title\n  #align(center, ${figure})\n  #layout(size => [#metadata(size) <region>])\n]`,
    'touying.typ': (figure: string) =>
      `== A title\n\n#align(center, ${figure})\n#layout(size => [#metadata(size) <region>])`,
  };
  const preambles = {
    'polylux.typ': `#import "@preview/polylux:0.4.0": *\n#set page(paper: "presentation-16-9", margin: 1.5cm)\n#set text(size: 20pt)`,
    'touying.typ': `#import "@preview/touying:0.8.0": *\n#import themes.simple: *\n#show: simple-theme.with(aspect-ratio: "16-9")`,
  };

  it.for(['polylux.typ', 'touying.typ'] as const)(
    'fills the slide in %s',
    (file, ctx) => {
      if (missing !== undefined) ctx.skip(missing);
      const ids = ['kruskal', 'dijkstra', 'binary-search'];
      writeFileSync(
        join(installed!.root, file),
        [
          preambles[file],
          `#import "${spec}": algoviz-slides`,
          ...ids.map((id) =>
            filling[file](`algoviz-slides(only, "${id}", steps: -1)`),
          ),
          // A series of two frames, on two subslides.
          filling[file](`algoviz-slides(only, "dijkstra", steps: (0, -1))`),
        ].join('\n\n'),
      );
      const regions = JSON.parse(
        typst([
          'query',
          '--root',
          installed!.root,
          join(installed!.root, file),
          '<region>',
          '--field',
          'value',
        ]).stdout,
      ) as { width: string; height: string }[];
      const pages = pageSvgs(file, installed!.root).map(imageSizes);
      expect(pages.map((p) => p.length)).toEqual([1, 1, 1, 1, 1]);
      expect(regions).toHaveLength(5);
      pages.forEach(([image], k) => {
        const region = regions[k]!;
        const w = Number.parseFloat(region.width);
        const h = 0.75 * Number.parseFloat(region.height);
        expect(image!.width, `page ${k + 1}`).toBeLessThanOrEqual(w + 0.01);
        expect(image!.height, `page ${k + 1}`).toBeLessThanOrEqual(h + 0.01);
      });
      // Both frames of the series, placed in its box, get one size: the
      // size of the hidden copy and of the frame drawn alone.
      expect(pages[4]).toEqual(pages[3]);
      expect(pages[3]![0]!.height).toBeCloseTo(pages[1]![0]!.height, 2);
      // Kruskal is bound by the height here too, by a hair: at 16:9 its
      // canvas is a little wider than the slide box.
      expect(pages[0]![0]!.height).toBeCloseTo(
        0.75 * Number.parseFloat(regions[0]!.height),
        1,
      );
      expect(pages[1]![0]!.height).toBeCloseTo(
        0.75 * Number.parseFloat(regions[1]!.height),
        1,
      );
      expect(pages[2]![0]!.height).toBeCloseTo(
        0.75 * Number.parseFloat(regions[2]!.height),
        1,
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
