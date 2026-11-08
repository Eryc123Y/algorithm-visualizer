/**
 * Generates the metrics and outlines of the bundled font faces (ADR 0024,
 * 0030) into packages/fonts/src/faces/, and the licences into the OFL.txt of
 * packages/fonts and of the Typst package.
 *
 *   npm run generate:fonts
 *
 * Downloads each pinned file once with curl (cached in
 * node_modules/.cache), checks its SHA-256 and reads it with opentype.js.
 * JetBrains Mono and Inter come from their release archives. The faces of
 * the themes of ADR 0030 come from the google/fonts repository at one
 * commit: HarfBuzz (subset-font) pins a variable font at the face's weight
 * and cuts every face down to the measured ranges first. Writes one module
 * of metrics and one of outlines per face. Run it only when a font or the
 * coverage changes, and review the diff. It never runs in CI or at run time.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { advanceRuns, encodePath } from '@algoviz/fonts/encode';
import opentype, { type Font } from 'opentype.js';
import subsetFont from 'subset-font';

/** A release archive, and the licence file inside it. */
interface Release {
  readonly name: string;
  readonly url: string;
  readonly sha256: string;
  readonly licence: string;
}

/** A file of the google/fonts repository at `GOOGLE_FONTS`, under `ofl/`. */
interface GoogleFile {
  readonly path: string;
  readonly sha256: string;
}

/** The commit of google/fonts that the faces of ADR 0030 come from. */
const GOOGLE_FONTS = '86aced91de05cd4f96a06838124cca45be337b2b';

/** A family directory of google/fonts: its licence and a name for it. */
interface GoogleFamily {
  readonly name: string;
  readonly licence: GoogleFile;
}

type Source =
  | {
      readonly kind: 'release';
      readonly release: Release;
      /** Path of the font file inside the release archive. */
      readonly file: string;
    }
  | {
      readonly kind: 'google';
      readonly family: GoogleFamily;
      readonly file: GoogleFile;
      /** Axis values that pin a variable font at this face. */
      readonly axes?: Readonly<Record<string, number>>;
    };

interface Face {
  readonly id: string;
  /** Name of the exported constant. */
  readonly constant: string;
  readonly family: string;
  readonly weight: number;
  readonly source: Source;
}

const jetbrainsMono: Release = {
  name: 'JetBrains Mono 2.304',
  url: 'https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip',
  sha256: '6f6376c6ed2960ea8a963cd7387ec9d76e3f629125bc33d1fdcd7eb7012f7bbf',
  licence: 'OFL.txt',
};

const inter: Release = {
  name: 'Inter 4.1',
  url: 'https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip',
  sha256: '9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e',
  licence: 'LICENSE.txt',
};

const google = (dir: string, name: string, sha256: string): GoogleFamily => ({
  name,
  licence: { path: `${dir}/OFL.txt`, sha256 },
});

const stixTwoText = google(
  'stixtwotext',
  'STIX Two Text',
  '62c0967a997b9691326d35b1f90baf085a557327b711618bc4161325ce1bb1b2',
);
const lexend = google(
  'lexend',
  'Lexend',
  '5da8505887d0fa7fe963445fd58852707fda34adfeb65af25c99d152bab285bd',
);
const notoSans = google(
  'notosans',
  'Noto Sans',
  'cee9892f9f0cc8fe882c9e9537ee6a89621d86ee7ceaf70b02e2b2b1c25c061a',
);
const notoSansMono = google(
  'notosansmono',
  'Noto Sans Mono',
  'cee9892f9f0cc8fe882c9e9537ee6a89621d86ee7ceaf70b02e2b2b1c25c061a',
);
const dotGothic16 = google(
  'dotgothic16',
  'DotGothic16',
  'b6630c61ea078cacd7fabe37d14ffe557a0b45b06683374a9aa9e24262993e33',
);

const faces: readonly Face[] = [
  {
    id: 'jetbrains-mono-semibold',
    constant: 'jetbrainsMonoSemiBold',
    family: 'JetBrains Mono',
    weight: 600,
    source: {
      kind: 'release',
      release: jetbrainsMono,
      file: 'fonts/ttf/JetBrainsMono-SemiBold.ttf',
    },
  },
  {
    id: 'inter-semibold',
    constant: 'interSemiBold',
    family: 'Inter',
    weight: 600,
    source: {
      kind: 'release',
      release: inter,
      file: 'extras/ttf/Inter-SemiBold.ttf',
    },
  },
  {
    id: 'stix-two-text-semibold',
    constant: 'stixTwoTextSemiBold',
    family: 'STIX Two Text',
    weight: 600,
    source: {
      kind: 'google',
      family: stixTwoText,
      file: {
        path: 'stixtwotext/STIXTwoText[wght].ttf',
        sha256:
          '7962b8b7811e6a896c9a91a0bccbb5241047770eb24d4997c5cb5fe21d5c0df2',
      },
      axes: { wght: 600 },
    },
  },
  {
    id: 'lexend-semibold',
    constant: 'lexendSemiBold',
    family: 'Lexend',
    weight: 600,
    source: {
      kind: 'google',
      family: lexend,
      file: {
        path: 'lexend/Lexend[wght].ttf',
        sha256:
          '3add53e641fbc81da64da4bb254285e2831b52b029527bc0714e2b9610832ee6',
      },
      axes: { wght: 600 },
    },
  },
  {
    id: 'noto-sans-semibold',
    constant: 'notoSansSemiBold',
    family: 'Noto Sans',
    weight: 600,
    source: {
      kind: 'google',
      family: notoSans,
      file: {
        path: 'notosans/NotoSans[wdth,wght].ttf',
        sha256:
          'bfb7bb691513f12e734dc346c03a03f784912432d7e3fa8e56efcf906fe86b3d',
      },
      axes: { wdth: 100, wght: 600 },
    },
  },
  {
    id: 'noto-sans-mono-semibold',
    constant: 'notoSansMonoSemiBold',
    family: 'Noto Sans Mono',
    weight: 600,
    source: {
      kind: 'google',
      family: notoSansMono,
      file: {
        path: 'notosansmono/NotoSansMono[wdth,wght].ttf',
        sha256:
          '2cb2adb378a8f574213e23df697050b83c54c27df465a2015552740b2769a081',
      },
      axes: { wdth: 100, wght: 600 },
    },
  },
  {
    id: 'dotgothic16-regular',
    constant: 'dotGothic16Regular',
    family: 'DotGothic16',
    weight: 400,
    source: {
      kind: 'google',
      family: dotGothic16,
      file: {
        path: 'dotgothic16/DotGothic16-Regular.ttf',
        sha256:
          '3ad9af88726d42b40f7f365f0dcac785af73cf20ea6f1d5b44e57cc21150b8f1',
      },
    },
  },
];

type Range = readonly [number, number];

/** Blocks whose advances the metrics hold, where the face has the glyph. */
const MEASURED: readonly Range[] = [
  [0x0020, 0x007e], // Basic Latin
  [0x00a0, 0x00ff], // Latin-1 Supplement
  [0x0100, 0x017f], // Latin Extended-A
  [0x0370, 0x03ff], // Greek and Coptic
  [0x0400, 0x04ff], // Cyrillic
  [0x2000, 0x206f], // General Punctuation
  [0x2070, 0x209f], // Superscripts and Subscripts
  [0x20a0, 0x20cf], // Currency Symbols
  [0x2100, 0x214f], // Letterlike Symbols
  [0x2190, 0x21ff], // Arrows
  [0x2200, 0x22ff], // Mathematical Operators
  [0x2300, 0x23ff], // Miscellaneous Technical
  [0x25a0, 0x25ff], // Geometric Shapes
  [0x2600, 0x26ff], // Miscellaneous Symbols
  [0x2700, 0x27bf], // Dingbats
];

/** Code points whose outlines standalone SVG draws. */
const OUTLINED: readonly Range[] = [
  [0x0020, 0x007e], // ASCII
  [0x00a0, 0x00ac], // Latin-1 symbols: ¢ £ § ¬ …
  [0x00ae, 0x00bf], // ® ° ± ² ³ · ¹ ½ …, but not the soft hyphen
  [0x00d7, 0x00d7], // ×
  [0x00f7, 0x00f7], // ÷
  [0x0391, 0x03a9], // Greek capitals
  [0x03b1, 0x03c9], // Greek small letters
  [0x2013, 0x2014], // – —
  [0x2018, 0x201d], // ‘ ’ ‚ ‛ “ ”
  [0x2022, 0x2022], // •
  [0x2026, 0x2026], // …
  [0x2032, 0x2033], // ′ ″
  [0x2070, 0x2070], // ⁰
  [0x2074, 0x2079], // ⁴ … ⁹
  [0x2080, 0x2089], // ₀ … ₉
  [0x2190, 0x2195], // ← ↑ → ↓ ↔ ↕
  [0x21d0, 0x21d4], // ⇐ ⇑ ⇒ ⇓ ⇔
  [0x2200, 0x2200], // ∀
  [0x2202, 0x2203], // ∂ ∃
  [0x2205, 0x2205], // ∅
  [0x2207, 0x2209], // ∇ ∈ ∉
  [0x220f, 0x220f], // ∏
  [0x2211, 0x2213], // ∑ − ∓
  [0x2218, 0x221a], // ∘ ∙ √
  [0x221e, 0x221e], // ∞
  [0x2227, 0x222b], // ∧ ∨ ∩ ∪ ∫
  [0x2248, 0x2248], // ≈
  [0x2260, 0x2261], // ≠ ≡
  [0x2264, 0x2265], // ≤ ≥
  [0x2282, 0x2283], // ⊂ ⊃
  [0x2286, 0x2287], // ⊆ ⊇
  [0x2295, 0x2295], // ⊕
  [0x2297, 0x2297], // ⊗
  [0x22a5, 0x22a5], // ⊥
  [0x2308, 0x230b], // ⌈ ⌉ ⌊ ⌋
  [0x25a0, 0x25a1], // ■ □
  [0x25b2, 0x25b3], // ▲ △
  [0x25b6, 0x25b6], // ▶
  [0x25bc, 0x25bc], // ▼
  [0x25c0, 0x25c0], // ◀
  [0x25cb, 0x25cb], // ○
  [0x25cf, 0x25cf], // ●
  [0x2605, 0x2606], // ★ ☆
  [0x2713, 0x2714], // ✓ ✔
  [0x2717, 0x2718], // ✗ ✘
];

const root = new URL('../', import.meta.url);
const cache = new URL('node_modules/.cache/algoviz-fonts/', root);
const out = new URL('packages/fonts/src/faces/', root);

/** Downloads `url` once into the cache and checks its SHA-256. */
function download(url: string, name: string, sha256: string): string {
  mkdirSync(cache, { recursive: true });
  const path = new URL(name, cache).pathname;
  if (!existsSync(path)) {
    console.log(`Downloading ${url}`);
    // curl rather than fetch: it honours the proxy settings of the shell.
    execFileSync('curl', ['-fsSL', '-o', path, url]);
  }
  const digest = createHash('sha256').update(readFileSync(path)).digest('hex');
  if (digest !== sha256)
    throw new Error(`${path}: SHA-256 ${digest}, expected ${sha256}`);
  return path;
}

/** The release archive, downloaded once and checked. */
const archive = (release: Release): string =>
  download(release.url, release.url.split('/').at(-1)!, release.sha256);

/** A file of google/fonts at the pinned commit, downloaded once and checked. */
const googleFile = (file: GoogleFile): Buffer =>
  readFileSync(
    download(
      `https://raw.githubusercontent.com/google/fonts/${GOOGLE_FONTS}/ofl/${file.path
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`,
      `google-${GOOGLE_FONTS.slice(0, 7)}-${file.path.replaceAll('/', '_')}`,
      file.sha256,
    ),
  );

const extract = (zip: string, member: string): Buffer =>
  execFileSync('unzip', ['-p', zip, member], { maxBuffer: 1 << 26 });

const toArrayBuffer = (b: Buffer): ArrayBuffer =>
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

function* codePoints(ranges: readonly Range[]): Generator<number> {
  for (const [first, last] of ranges)
    for (let cp = first; cp <= last; cp++) yield cp;
}

const has = (font: Font, cp: number) =>
  font.charToGlyphIndex(String.fromCodePoint(cp)) !== 0;

/** Advances of the code points the face has, as runs. */
function advanceRunsOf(font: Font): string[] {
  const advances = [...codePoints(MEASURED)]
    .filter((cp) => has(font, cp))
    .map(
      (cp) =>
        [cp, font.charToGlyph(String.fromCodePoint(cp)).advanceWidth] as const,
    );
  return advanceRuns(advances).map((run) =>
    typeof run[1] === 'number'
      ? `[${run.join(', ')}]`
      : `[${run[0]}, [${run[1].join(', ')}]]`,
  );
}

/**
 * Licence notice of a generated module. `/*!` and `@license` keep it in
 * compiled and minified output, and the blank line after it keeps
 * TypeScript from dropping it with the type-only import it precedes.
 */
function header(face: Face, licence: string): string {
  const copyright = licence.split('\n')[0]!.trim();
  return `/*!
 * Generated by scripts/fonts.ts from ${origin(face.source)}.
 * Do not edit; run \`npm run generate:fonts\` instead.
 *
 * ${copyright}
 * This Font Software is licensed under the SIL Open Font License, Version 1.1,
 * which packages/fonts/OFL.txt reproduces.
 * @license OFL-1.1
 */

`;
}

/** Joins items into lines of at most about 80 characters. */
function wrap(items: readonly string[], indent: string): string {
  const lines: string[] = [];
  let line = '';
  for (const item of items) {
    if (line !== '' && indent.length + line.length + item.length + 2 > 80) {
      lines.push(line);
      line = '';
    }
    line += line === '' ? item : ` ${item}`;
  }
  if (line !== '') lines.push(line);
  return lines.map((l) => `${indent}${l}`).join('\n');
}

function metricsModule(face: Face, font: Font, licence: string): string {
  const runs = advanceRunsOf(font).map((run) => {
    const short = `${run},`;
    if (short.length <= 72) return [short];
    const [first, widths] = /^\[(\d+), \[(.*)\]\]$/.exec(run)!.slice(1);
    return [
      `[\n      ${first},\n      [\n${wrap(
        widths!.split(', ').map((w) => `${w},`),
        '        ',
      )}\n      ],\n    ],`,
    ];
  });
  return `${header(face, licence)}import type { FontMetrics } from '../types.ts';

export const ${face.constant}: FontMetrics = {
  id: '${face.id}',
  family: '${face.family}',
  weight: ${face.weight},
  unitsPerEm: ${font.unitsPerEm},
  advances: [
${runs
  .flat()
  .map((r) => `    ${r}`)
  .join('\n')}
  ],
};
`;
}

function outlinesModule(face: Face, font: Font, licence: string): string {
  const glyphs = [...codePoints(OUTLINED)]
    .filter((cp) => has(font, cp))
    .map((cp) => {
      const path = encodePath(
        font.charToGlyph(String.fromCodePoint(cp)).path.commands,
      );
      return `    [${cp}, '${path}'],`;
    });
  return `${header(face, licence)}import type { FontOutlines } from '../types.ts';

export const ${face.constant}Outlines: FontOutlines = {
  id: '${face.id}',
  unitsPerEm: ${font.unitsPerEm},
  glyphs: [
${glyphs.join('\n')}
  ],
};
`;
}

/** Where a face comes from, for the header of its modules. */
function origin(source: Source): string {
  if (source.kind === 'release')
    return `${source.release.name} (${source.file.split('/').at(-1)})`;
  const axes = Object.entries(source.axes ?? {})
    .map(([axis, value]) => `, ${axis} ${value}`)
    .join('');
  return `google/fonts ${GOOGLE_FONTS.slice(0, 7)} (${source.file.path}${axes})`;
}

/** Every code point of the measured ranges, for cutting a face down. */
const measuredText = String.fromCodePoint(...codePoints(MEASURED));

/** A licence: where it comes from and its text. */
interface Licence {
  readonly name: string;
  readonly text: string;
}

/** The face's font, read with opentype.js, and its licence. */
async function load(face: Face): Promise<{ font: Font; licence: Licence }> {
  const source = face.source;
  if (source.kind === 'release') {
    const zip = archive(source.release);
    return {
      font: opentype.parse(toArrayBuffer(extract(zip, source.file))),
      licence: {
        name: `${source.release.name} (${source.release.licence})`,
        text: extract(zip, source.release.licence).toString('utf8'),
      },
    };
  }
  const cut = await subsetFont(googleFile(source.file), measuredText, {
    targetFormat: 'sfnt',
    ...(source.axes === undefined ? {} : { variationAxes: source.axes }),
  });
  return {
    font: opentype.parse(toArrayBuffer(cut)),
    licence: {
      name: `${source.family.name} (google/fonts ${GOOGLE_FONTS.slice(0, 7)}, ofl/${source.family.licence.path})`,
      text: googleFile(source.family.licence)
        .toString('utf8')
        .replace(/\r\n?/g, '\n'),
    },
  };
}

// One licence per release or family, in the order faces first use it.
const licences = new Map<string, Licence>();
for (const face of faces) {
  const { font, licence } = await load(face);
  licences.set(licence.name, licence);
  mkdirSync(out, { recursive: true });
  writeFileSync(
    new URL(`${face.id}.ts`, out),
    metricsModule(face, font, licence.text),
  );
  writeFileSync(
    new URL(`${face.id}-outlines.ts`, out),
    outlinesModule(face, font, licence.text),
  );
  console.log(`Wrote ${face.id}`);
}

// One licence file reproducing each font's licence as its source ships it,
// for the fonts package and the Typst package, whose engine carries the
// outlines (ADR 0026).
const ofl = [...licences.values()]
  .map(({ name, text }) => `${name}\n\n${text.trim()}\n`)
  .join('\n' + '-'.repeat(72) + '\n\n');
for (const path of [
  'packages/fonts/OFL.txt',
  'packages/typst/package/OFL.txt',
]) {
  writeFileSync(new URL(path, root), ofl);
  console.log(`Wrote ${path}`);
}
