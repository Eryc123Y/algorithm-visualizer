/**
 * File names for exported figures (ADR 0025, 0027, 0028): a pattern whose
 * placeholders `{name}`, `{frame}` and `{step}` are filled in per figure,
 * or one name for a whole series in one TikZ file. Writing the files is the
 * command line's job; this part stays pure.
 */
import { err, ok, type Result } from '@algoviz/spec';

export const DEFAULT_PATTERN = '{name}-{frame}';

/** The default name of a series written into one file (`--one-file`). */
export const ONE_FILE_PATTERN = '{name}';

const PLACEHOLDERS: readonly string[] = ['name', 'frame', 'step'];

/** The figure formats `export` writes, by their file extensions. */
export const FORMAT_EXTENSIONS = { svg: '.svg', tikz: '.tex' } as const;

export type FigureFormat = keyof typeof FORMAT_EXTENSIONS;

/** What file names are made of: a frame and its selector. */
export interface NamedFrame {
  readonly frame: number;
  readonly selector: string;
}

export interface FileNameOptions {
  /** What `{name}` stands for: a document file's name, or an algorithm id. */
  readonly name: string;
  /**
   * Default `{name}-{frame}`; the format's extension is appended unless it
   * ends with it.
   */
  readonly pattern?: string;
  /** Default `svg`. */
  readonly format?: FigureFormat;
  /**
   * Every figure in one file (TikZ only, ADR 0028): the pattern names that
   * file, `{name}` by default, and cannot use `{frame}` or `{step}`.
   */
  readonly oneFile?: boolean;
}

export interface FigureFile<F extends NamedFrame> {
  /** A file name, without a directory. */
  readonly file: string;
  readonly figure: F;
}

/** Matches a pattern's own extension for `format`, which is not repeated. */
const extensionOf = (format: FigureFormat) =>
  new RegExp(`\\${FORMAT_EXTENSIONS[format]}$`, 'i');

/** What is wrong with a pattern on its own, if anything. */
export function patternProblem(
  pattern: string,
  format: FigureFormat = 'svg',
  oneFile = false,
): string | undefined {
  if (oneFile && format !== 'tikz')
    return '--one-file needs --format tikz: an SVG file holds one figure';
  if (/[/\\]/.test(pattern))
    return `The name "${pattern}" contains a path separator; choose the directory with --out`;
  for (const [, key] of pattern.matchAll(/\{([^}]*)\}/g))
    if (!PLACEHOLDERS.includes(key!))
      return `Unknown placeholder {${key}} in the name; use {name}, {frame} or {step}`;
  if (/[{}]/.test(pattern.replace(/\{(?:name|frame|step)\}/g, '')))
    return `The name "${pattern}" has a brace outside {name}, {frame} and {step}`;
  if (pattern.replace(extensionOf(format), '') === '')
    return 'The name is empty';
  if (oneFile && /\{(?:frame|step)\}/.test(pattern))
    return `The name "${pattern}" names a file per frame; --one-file writes one file, so leave out {frame} and {step}`;
  return undefined;
}

/**
 * `{step}`: a selector with `/` and `#` spelled `_`. Names cannot contain
 * `_`, so different frames keep different names.
 */
const stepPart = (selector: string) => selector.replace(/[/#]/g, '_');

/**
 * A file name for each figure of a series. `{frame}` is padded with zeros
 * to the width of the document's last frame number, so files sort in
 * timeline order. With `oneFile`, every figure gets the same file. The error
 * is a message about the pattern.
 */
export function figureFiles<F extends NamedFrame>(
  series: { readonly frames: number; readonly figures: readonly F[] },
  {
    name,
    format = 'svg',
    oneFile = false,
    pattern = oneFile ? ONE_FILE_PATTERN : DEFAULT_PATTERN,
  }: FileNameOptions,
): Result<readonly FigureFile<F>[], string> {
  const problem = patternProblem(pattern, format, oneFile);
  if (problem !== undefined) return err(problem);
  if (
    !oneFile &&
    series.figures.length > 1 &&
    !/\{(?:frame|step)\}/.test(pattern)
  )
    return err(
      `The name "${pattern}" gives every figure the same file; add {frame} or {step}`,
    );
  const digits = String(Math.max(0, series.frames - 1)).length;
  const base = pattern.replace(extensionOf(format), '');
  return ok(
    series.figures.map((figure) => {
      const part: Readonly<Record<string, string>> = {
        name,
        frame: String(figure.frame).padStart(digits, '0'),
        step: stepPart(figure.selector),
      };
      const file = base.replace(
        /\{(name|frame|step)\}/g,
        (_, key: string) => part[key]!,
      );
      return { file: `${file}${FORMAT_EXTENSIONS[format]}`, figure };
    }),
  );
}
