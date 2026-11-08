/**
 * Where the bundled fonts come from (ADR 0024, 0030), shared by the scripts
 * that generate their metrics, outlines and web fonts: pinned release
 * archives and files of the google/fonts repository at one commit, each
 * downloaded once with curl into node_modules/.cache and checked by its
 * SHA-256, and HarfBuzz (subset-font) to pin a variable font's axes and cut
 * a face down to the characters needed.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

import subsetFont from 'subset-font';

/** A release archive, and the licence file inside it. */
export interface Release {
  readonly name: string;
  readonly url: string;
  readonly sha256: string;
  readonly licence: string;
}

/** A file of the google/fonts repository at `GOOGLE_FONTS`, under `ofl/`. */
export interface GoogleFile {
  readonly path: string;
  readonly sha256: string;
}

/** The commit of google/fonts that the faces of ADR 0030 come from. */
export const GOOGLE_FONTS = '86aced91de05cd4f96a06838124cca45be337b2b';

/** A family directory of google/fonts: its licence and a name for it. */
export interface GoogleFamily {
  readonly name: string;
  readonly licence: GoogleFile;
}

export type Source =
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

export const jetbrainsMono: Release = {
  name: 'JetBrains Mono 2.304',
  url: 'https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip',
  sha256: '6f6376c6ed2960ea8a963cd7387ec9d76e3f629125bc33d1fdcd7eb7012f7bbf',
  licence: 'OFL.txt',
};

export const inter: Release = {
  name: 'Inter 4.1',
  url: 'https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip',
  sha256: '9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e',
  licence: 'LICENSE.txt',
};

const google = (dir: string, name: string, sha256: string): GoogleFamily => ({
  name,
  licence: { path: `${dir}/OFL.txt`, sha256 },
});

export const stixTwoText = google(
  'stixtwotext',
  'STIX Two Text',
  '62c0967a997b9691326d35b1f90baf085a557327b711618bc4161325ce1bb1b2',
);
export const lexend = google(
  'lexend',
  'Lexend',
  '5da8505887d0fa7fe963445fd58852707fda34adfeb65af25c99d152bab285bd',
);
export const notoSans = google(
  'notosans',
  'Noto Sans',
  'cee9892f9f0cc8fe882c9e9537ee6a89621d86ee7ceaf70b02e2b2b1c25c061a',
);
export const notoSansMono = google(
  'notosansmono',
  'Noto Sans Mono',
  'cee9892f9f0cc8fe882c9e9537ee6a89621d86ee7ceaf70b02e2b2b1c25c061a',
);
export const dotGothic16 = google(
  'dotgothic16',
  'DotGothic16',
  'b6630c61ea078cacd7fabe37d14ffe557a0b45b06683374a9aa9e24262993e33',
);

export const dmMono = google(
  'dmmono',
  'DM Mono',
  '2bada5ea45c3c63b7f1ea1f88ce9672c9e4f0c42b2c3b7378949084fe55a3066',
);

export type Range = readonly [number, number];

/** Blocks whose advances the metrics hold, where the face has the glyph. */
export const MEASURED: readonly Range[] = [
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

export function* codePoints(ranges: readonly Range[]): Generator<number> {
  for (const [first, last] of ranges)
    for (let cp = first; cp <= last; cp++) yield cp;
}

/** Every code point of the measured ranges, for cutting a face down. */
export const measuredText = String.fromCodePoint(...codePoints(MEASURED));

export const root = new URL('../', import.meta.url);
const cache = new URL('node_modules/.cache/algoviz-fonts/', root);

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

export const toArrayBuffer = (b: Buffer): ArrayBuffer =>
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

/** The font file of a source, as its release or google/fonts ships it. */
export const fontFile = (source: Source): Buffer =>
  source.kind === 'release'
    ? extract(archive(source.release), source.file)
    : googleFile(source.file);

/**
 * The font of a source cut down to `text`, with a variable font pinned at
 * the source's axes, as TrueType or WOFF2.
 */
export const cut = (
  source: Source,
  text: string,
  targetFormat: 'sfnt' | 'woff2',
): Promise<Buffer> =>
  subsetFont(fontFile(source), text, {
    targetFormat,
    ...(source.kind === 'google' && source.axes !== undefined
      ? { variationAxes: source.axes }
      : {}),
  });

/** A licence: where it comes from and its text. */
export interface Licence {
  readonly name: string;
  readonly text: string;
}

/** The licence of a source, with its line endings made Unix ones. */
export function licenceOf(source: Source): Licence {
  if (source.kind === 'release')
    return {
      name: `${source.release.name} (${source.release.licence})`,
      text: extract(archive(source.release), source.release.licence).toString(
        'utf8',
      ),
    };
  return {
    name: `${source.family.name} (google/fonts ${GOOGLE_FONTS.slice(0, 7)}, ofl/${source.family.licence.path})`,
    text: googleFile(source.family.licence)
      .toString('utf8')
      .replace(/\r\n?/g, '\n'),
  };
}

/** Joins licences into one file, each as its source ships it. */
export const licenceFile = (licences: Iterable<Licence>): string =>
  [...licences]
    .map(({ name, text }) => `${name}\n\n${text.trim()}\n`)
    .join('\n' + '-'.repeat(72) + '\n\n');

/** Where a face comes from, for the header of a generated file. */
export function origin(source: Source): string {
  if (source.kind === 'release')
    return `${source.release.name} (${source.file.split('/').at(-1)})`;
  const axes = Object.entries(source.axes ?? {})
    .map(([axis, value]) => `, ${axis} ${value}`)
    .join('');
  return `google/fonts ${GOOGLE_FONTS.slice(0, 7)} (${source.file.path}${axes})`;
}
