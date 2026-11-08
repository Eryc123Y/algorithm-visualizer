/**
 * The player's web fonts (ADR 0030): WOFF2 subsets of every face the chrome
 * and the figures of the built-in themes draw, at the weights they use,
 * and one stylesheet that declares them, in
 * packages/elements/src/fonts/. Each weight is two files, the Latin text
 * and the rest of the measured ranges, with `unicode-range`, so a page
 * downloads only what it draws. Run through `npm run generate:fonts`.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

import opentype from 'opentype.js';

import {
  codePoints,
  cut,
  dmMono,
  dotGothic16,
  inter,
  jetbrainsMono,
  lexend,
  licenceFile,
  licenceOf,
  measuredText,
  notoSans,
  notoSansMono,
  origin,
  root,
  stixTwoText,
  toArrayBuffer,
  type GoogleFamily,
  type Licence,
  type Range,
  type Source,
} from './font-sources.ts';

interface WebFace {
  /** File name stem, e.g. "inter-600". */
  readonly name: string;
  readonly family: string;
  readonly weight: number;
  readonly source: Source;
}

/** The Latin text: what nearly every page draws. */
const LATIN: readonly Range[] = [
  [0x0020, 0x007e],
  [0x00a0, 0x00ff],
  [0x2000, 0x206f],
];

const release = (
  name: string,
  family: string,
  weight: number,
  r: typeof inter,
  file: string,
): WebFace => ({
  name,
  family,
  weight,
  source: { kind: 'release', release: r, file },
});

const google = (
  name: string,
  family: GoogleFamily,
  weight: number,
  path: string,
  sha256: string,
  axes?: Readonly<Record<string, number>>,
): WebFace => ({
  name,
  family: family.name,
  weight,
  source: {
    kind: 'google',
    family,
    file: { path, sha256 },
    ...(axes === undefined ? {} : { axes }),
  },
});

const STIX = 'stixtwotext/STIXTwoText[wght].ttf';
const STIX_SHA =
  '7962b8b7811e6a896c9a91a0bccbb5241047770eb24d4997c5cb5fe21d5c0df2';
const LEXEND = 'lexend/Lexend[wght].ttf';
const LEXEND_SHA =
  '3add53e641fbc81da64da4bb254285e2831b52b029527bc0714e2b9610832ee6';
const NOTO = 'notosans/NotoSans[wdth,wght].ttf';
const NOTO_SHA =
  'bfb7bb691513f12e734dc346c03a03f784912432d7e3fa8e56efcf906fe86b3d';
const NOTO_MONO = 'notosansmono/NotoSansMono[wdth,wght].ttf';
const NOTO_MONO_SHA =
  '2cb2adb378a8f574213e23df697050b83c54c27df465a2015552740b2769a081';

const webFaces: readonly WebFace[] = [
  release('inter-400', 'Inter', 400, inter, 'extras/ttf/Inter-Regular.ttf'),
  release('inter-600', 'Inter', 600, inter, 'extras/ttf/Inter-SemiBold.ttf'),
  release(
    'jetbrains-mono-400',
    'JetBrains Mono',
    400,
    jetbrainsMono,
    'fonts/ttf/JetBrainsMono-Regular.ttf',
  ),
  release(
    'jetbrains-mono-600',
    'JetBrains Mono',
    600,
    jetbrainsMono,
    'fonts/ttf/JetBrainsMono-SemiBold.ttf',
  ),
  google('stix-two-text-400', stixTwoText, 400, STIX, STIX_SHA, { wght: 400 }),
  google('stix-two-text-600', stixTwoText, 600, STIX, STIX_SHA, { wght: 600 }),
  google('lexend-400', lexend, 400, LEXEND, LEXEND_SHA, { wght: 400 }),
  google('lexend-600', lexend, 600, LEXEND, LEXEND_SHA, { wght: 600 }),
  google('noto-sans-400', notoSans, 400, NOTO, NOTO_SHA, {
    wdth: 100,
    wght: 400,
  }),
  google('noto-sans-600', notoSans, 600, NOTO, NOTO_SHA, {
    wdth: 100,
    wght: 600,
  }),
  google('noto-sans-mono-400', notoSansMono, 400, NOTO_MONO, NOTO_MONO_SHA, {
    wdth: 100,
    wght: 400,
  }),
  google('noto-sans-mono-600', notoSansMono, 600, NOTO_MONO, NOTO_MONO_SHA, {
    wdth: 100,
    wght: 600,
  }),
  google(
    'dm-mono-400',
    dmMono,
    400,
    'dmmono/DMMono-Regular.ttf',
    '55b4c98f123daebb3ed27947ba47b2af00554fc6284d639a540bcef5e6258ad2',
  ),
  google(
    'dm-mono-500',
    dmMono,
    500,
    'dmmono/DMMono-Medium.ttf',
    'fd327daf461db87b44a87def475d251bf03b997f7c07d9680592d75dbbfaad0b',
  ),
  google(
    'dotgothic16-400',
    dotGothic16,
    400,
    'dotgothic16/DotGothic16-Regular.ttf',
    '3ad9af88726d42b40f7f365f0dcac785af73cf20ea6f1d5b44e57cc21150b8f1',
  ),
];

const hex = (cp: number) => cp.toString(16).toUpperCase().padStart(4, '0');

/** Code points as a CSS `unicode-range`, consecutive ones joined. */
function unicodeRange(cps: readonly number[]): string {
  const parts: string[] = [];
  let k = 0;
  while (k < cps.length) {
    let j = k;
    while (j + 1 < cps.length && cps[j + 1] === cps[j]! + 1) j++;
    parts.push(
      j === k ? `U+${hex(cps[k]!)}` : `U+${hex(cps[k]!)}-${hex(cps[j]!)}`,
    );
    k = j + 1;
  }
  return parts.join(', ');
}

/** The measured code points a face has, Latin first, then the rest. */
async function coverage(face: WebFace): Promise<[number[], number[]]> {
  const font = opentype.parse(
    toArrayBuffer(await cut(face.source, measuredText, 'sfnt')),
  );
  const latin = new Set(codePoints(LATIN));
  const has = [...new Set(codePoints([[0x20, 0x27bf]]))].filter(
    (cp) =>
      measuredText.includes(String.fromCodePoint(cp)) &&
      font.charToGlyphIndex(String.fromCodePoint(cp)) !== 0,
  );
  return [
    has.filter((cp) => latin.has(cp)),
    has.filter((cp) => !latin.has(cp)),
  ];
}

const out = new URL('packages/elements/src/fonts/', root);

/** Writes the WOFF2 files, fonts.css and OFL.txt of the player. */
export async function writeWebFonts(): Promise<void> {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const rules: string[] = [];
  const licences = new Map<string, Licence>();
  for (const face of webFaces) {
    const licence = licenceOf(face.source);
    licences.set(licence.name, licence);
    const parts = await coverage(face);
    for (const [part, cps] of [
      ['latin', parts[0]],
      ['symbols', parts[1]],
    ] as const) {
      if (cps.length === 0) continue;
      const file = `${face.name}-${part}.woff2`;
      const woff2 = await cut(
        face.source,
        String.fromCodePoint(...cps),
        'woff2',
      );
      writeFileSync(new URL(file, out), woff2);
      rules.push(
        [
          '@font-face {',
          `  font-family: '${face.family}';`,
          '  font-style: normal;',
          `  font-weight: ${face.weight};`,
          '  font-display: swap;',
          `  src: url('./${file}') format('woff2');`,
          `  unicode-range: ${unicodeRange(cps)};`,
          '}',
        ].join('\n'),
      );
    }
    console.log(`Wrote web font ${face.name}`);
  }
  const sources = webFaces
    .map((f) => ` * ${f.name}: ${origin(f.source)}`)
    .join('\n');
  writeFileSync(
    new URL('fonts.css', out),
    `/*!
 * The web fonts of the algoviz player (ADR 0030), generated by
 * scripts/web-fonts.ts; do not edit. Fonts under the SIL Open Font
 * License 1.1, which OFL.txt next to this file reproduces.
${sources}
 */
${rules.join('\n')}
`,
  );
  writeFileSync(new URL('OFL.txt', out), licenceFile(licences.values()));
  console.log('Wrote packages/elements/src/fonts/');
}
