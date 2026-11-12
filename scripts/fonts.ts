/**
 * Generates the metrics and outlines of the bundled font faces (ADR 0024,
 * 0030) into packages/fonts/src/faces/, their licences into the OFL.txt of
 * packages/fonts and of the Typst package, and the player's web fonts
 * (scripts/web-fonts.ts).
 *
 *   npm run generate:fonts
 *
 * JetBrains Mono and Inter are read from their release archives as they
 * are. The faces of the themes of ADR 0030 come from google/fonts, pinned
 * at the face's weight and cut down to the measured ranges first (see
 * scripts/font-sources.ts). Writes one module of metrics and one of
 * outlines per face. Run it only when a font or the coverage changes, and
 * review the diff. It never runs in CI or at run time.
 */
import { mkdirSync, writeFileSync } from 'node:fs';

import { advanceRuns, encodePath } from '@algomotion/fonts/encode';
import opentype, { type Font } from 'opentype.js';

import {
  codePoints,
  cut,
  dotGothic16,
  fontFile,
  inter,
  jetbrainsMono,
  lexend,
  licenceFile,
  licenceOf,
  MEASURED,
  measuredText,
  notoSans,
  notoSansMono,
  origin,
  root,
  stixTwoText,
  toArrayBuffer,
  type Licence,
  type Range,
  type Source,
} from './font-sources.ts';
import { writeWebFonts } from './web-fonts.ts';

interface Face {
  readonly id: string;
  /** Name of the exported constant. */
  readonly constant: string;
  readonly family: string;
  readonly weight: number;
  readonly source: Source;
}

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

const out = new URL('packages/fonts/src/faces/', root);

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

/** The face's font, read with opentype.js. */
async function load(face: Face): Promise<Font> {
  const source = face.source;
  const bytes =
    source.kind === 'release'
      ? fontFile(source)
      : await cut(source, measuredText, 'sfnt');
  return opentype.parse(toArrayBuffer(bytes));
}

// One licence per release or family, in the order faces first use it.
const licences = new Map<string, Licence>();
for (const face of faces) {
  const font = await load(face);
  const licence = licenceOf(face.source);
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

// The licences, for the fonts package and the Typst package, whose engine
// carries the outlines (ADR 0026).
const ofl = licenceFile(licences.values());
for (const path of [
  'packages/fonts/OFL.txt',
  'packages/typst/package/OFL.txt',
]) {
  writeFileSync(new URL(path, root), ofl);
  console.log(`Wrote ${path}`);
}

await writeWebFonts();
