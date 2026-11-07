/**
 * Generates the metrics and outlines of the bundled font faces (ADR 0024)
 * into packages/fonts/src/faces/, and packages/fonts/OFL.txt.
 *
 *   npm run generate:fonts
 *
 * Downloads each pinned release once with curl (cached in
 * node_modules/.cache), checks its SHA-256, extracts the face with `unzip`,
 * reads it with opentype.js and writes one module of metrics and one of
 * outlines per face. Run it only when a font or the coverage changes, and review the
 * diff. It never runs in CI or at run time.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { advanceRuns, encodePath } from '@algoviz/fonts/encode';
import opentype, { type Font } from 'opentype.js';

interface Release {
  readonly name: string;
  readonly url: string;
  readonly sha256: string;
  readonly licence: string;
}

interface Face {
  readonly id: string;
  /** Name of the exported constant. */
  readonly constant: string;
  readonly family: string;
  readonly weight: number;
  readonly release: Release;
  /** Path of the font file inside the release archive. */
  readonly file: string;
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

const faces: readonly Face[] = [
  {
    id: 'jetbrains-mono-semibold',
    constant: 'jetbrainsMonoSemiBold',
    family: 'JetBrains Mono',
    weight: 600,
    release: jetbrainsMono,
    file: 'fonts/ttf/JetBrainsMono-SemiBold.ttf',
  },
  {
    id: 'inter-semibold',
    constant: 'interSemiBold',
    family: 'Inter',
    weight: 600,
    release: inter,
    file: 'extras/ttf/Inter-SemiBold.ttf',
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

/** The release archive, downloaded once and checked. */
function archive(release: Release): string {
  mkdirSync(cache, { recursive: true });
  const path = new URL(release.url.split('/').at(-1)!, cache).pathname;
  if (!existsSync(path)) {
    console.log(`Downloading ${release.name}`);
    // curl rather than fetch: it honours the proxy settings of the shell.
    execFileSync('curl', ['-fsSL', '-o', path, release.url]);
  }
  const digest = createHash('sha256').update(readFileSync(path)).digest('hex');
  if (digest !== release.sha256)
    throw new Error(`${path}: SHA-256 ${digest}, expected ${release.sha256}`);
  return path;
}

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
 * Generated by scripts/fonts.ts from ${face.release.name} (${face.file.split('/').at(-1)}).
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

const licences = new Map<Release, string>();
for (const face of faces) {
  const zip = archive(face.release);
  const licence = extract(zip, face.release.licence).toString('utf8');
  licences.set(face.release, licence);
  const font = opentype.parse(toArrayBuffer(extract(zip, face.file)));
  mkdirSync(out, { recursive: true });
  writeFileSync(
    new URL(`${face.id}.ts`, out),
    metricsModule(face, font, licence),
  );
  writeFileSync(
    new URL(`${face.id}-outlines.ts`, out),
    outlinesModule(face, font, licence),
  );
  console.log(`Wrote ${face.id}`);
}

// One licence file reproducing each font's licence as its release ships it.
writeFileSync(
  new URL('packages/fonts/OFL.txt', root),
  [...licences]
    .map(
      ([release, text]) =>
        `${release.name} (${release.licence})\n\n${text.trim()}\n`,
    )
    .join('\n' + '-'.repeat(72) + '\n\n'),
);
console.log('Wrote packages/fonts/OFL.txt');
