/**
 * The versions a release publishes, and every place the repository writes
 * them (roadmap 4.3). The npm packages share one version, which the root
 * package, the site's footer and the MCP server report too; the Typst and
 * the LaTeX package each have their own (ADR 0021). `versions.spec.ts`
 * checks that every place agrees; `version.ts` rewrites them all at once.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Product = 'npm' | 'typst' | 'latex';

export type Versions = Readonly<Record<Product, string>>;

/** A pattern whose first group is a version of `product`. */
export interface Place {
  readonly product: Product;
  readonly pattern: RegExp;
  /** Only files whose path matches, when the pattern is not specific. */
  readonly files?: RegExp;
}

const VERSION = String.raw`(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)`;

export const PLACES: readonly Place[] = [
  // The packages' own versions, and their dependencies on each other.
  {
    product: 'npm',
    pattern: new RegExp(String.raw`^  "version": "${VERSION}"`, 'gm'),
    files:
      /^(package\.json|packages\/(spec|fonts|core|svg|tikz|recipes|elements|mcp)\/package\.json)$/,
  },
  {
    product: 'npm',
    pattern: new RegExp(String.raw`"@algomotion/[a-z]+": "${VERSION}"`, 'g'),
    files: /package\.json$/,
  },
  { product: 'npm', pattern: new RegExp(`SERVER_VERSION = '${VERSION}'`, 'g') },
  // The player from a CDN, and the GitHub release that carries the files.
  {
    product: 'npm',
    pattern: new RegExp(`@algomotion/elements@${VERSION}`, 'g'),
  },
  { product: 'npm', pattern: new RegExp(`releases/tag/v${VERSION}`, 'g') },
  // The Typst package: its manifest, its imports and its local folder.
  {
    product: 'typst',
    pattern: new RegExp(String.raw`^version = "${VERSION}"`, 'gm'),
    files: /typst\.toml$/,
  },
  { product: 'typst', pattern: new RegExp(`algomotion:${VERSION}`, 'g') },
  // The package's folder, under local/ or as the guides name it alone.
  { product: 'typst', pattern: new RegExp(`algomotion/${VERSION}`, 'g') },
  { product: 'typst', pattern: new RegExp(`algomotion-typst-${VERSION}`, 'g') },
  // The LaTeX package: its header, its cache key and its archive.
  {
    product: 'latex',
    pattern: new RegExp(
      String.raw`\\ProvidesExplPackage\{algomotion\}\{[0-9-]+\}\{${VERSION}\}`,
      'g',
    ),
  },
  {
    product: 'latex',
    pattern: new RegExp(
      String.raw`\\c__algomotion_version_str \{ ${VERSION} \}`,
      'g',
    ),
  },
  { product: 'latex', pattern: new RegExp(`algomotion-latex-${VERSION}`, 'g') },
];

/** A version number without leading zeros, as SemVer has it. */
const NUMBER = String.raw`(?:0|[1-9]\d*)`;
/** One identifier of a prerelease: a number, or letters and digits. */
const IDENTIFIER = String.raw`(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)`;
const SEMVER = new RegExp(
  `^${NUMBER}\\.${NUMBER}\\.${NUMBER}(?:-${IDENTIFIER}(?:\\.${IDENTIFIER})*)?$`,
);

/**
 * Whether `version` can be published for `product`: a SemVer version
 * without build metadata for npm, and a plain one, without a prerelease,
 * for Typst Universe and CTAN.
 */
export const isVersion = (product: Product, version: string): boolean =>
  SEMVER.test(version) && (product === 'npm' || !version.includes('-'));

/**
 * Files that record history rather than say the current version (the
 * changelog, the roadmap, the decisions, generated lock files), and this
 * module's tests, whose examples are versions of their own.
 */
const HISTORY =
  /^(CHANGELOG\.md|docs\/roadmap\.md|docs\/adr\/|.*package-lock\.json$|.*Cargo\.(toml|lock)$|scripts\/versions\.spec\.ts$)/;

/** The text files Git tracks, by path from `root`, but history. */
export function trackedFiles(root: string): string[] {
  return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(
      (path) =>
        path !== '' &&
        !HISTORY.test(path) &&
        /\.(json|jsonc|ts|mts|md|typ|toml|sty|tex|sh|yml|html)$/.test(path),
    );
}

/** One place a version is written: where, which product and which version. */
export interface Found {
  readonly file: string;
  readonly product: Product;
  readonly version: string;
  readonly text: string;
}

/** Every version written in `text`, the content of `file`. */
export function versionsIn(file: string, text: string): Found[] {
  return PLACES.filter(
    (p) => p.files === undefined || p.files.test(file),
  ).flatMap((p) =>
    [...text.matchAll(p.pattern)].map((m) => ({
      file,
      product: p.product,
      version: m[1]!,
      text: m[0],
    })),
  );
}

/** The versions of the release the repository is at. */
export function currentVersions(root: string): Versions {
  const read = (path: string) => readFileSync(join(root, path), 'utf8');
  const one = (path: string, product: Product) => {
    const found = versionsIn(path, read(path)).find(
      (f) => f.product === product,
    );
    if (found === undefined)
      throw new Error(`No ${product} version in ${path}`);
    return found.version;
  };
  return {
    npm: one('packages/spec/package.json', 'npm'),
    typst: one('packages/typst/package/typst.toml', 'typst'),
    latex: one('packages/latex/package/algomotion.sty', 'latex'),
  };
}

/**
 * `text` with every version of a product in `next` written as that
 * version; the LaTeX header also takes `date`, as `YYYY-MM-DD`.
 */
export function rewrite(
  file: string,
  text: string,
  next: Partial<Versions>,
  date: string,
): string {
  return PLACES.filter((p) => p.files === undefined || p.files.test(file))
    .filter((p) => next[p.product] !== undefined)
    .reduce(
      (out, p) =>
        out.replace(p.pattern, (whole: string, old: string) => {
          const swapped = whole.replace(old, next[p.product]!);
          return p.product === 'latex' && whole.startsWith('\\Provides')
            ? swapped.replace(/\{[0-9-]+\}/, `{${date}}`)
            : swapped;
        }),
      text,
    );
}
