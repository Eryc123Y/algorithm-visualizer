/**
 * The MCP tools as a command line, for people and for agents that run
 * commands rather than MCP tools:
 *
 *   algoviz guide [kind …]
 *   algoviz validate <file>
 *   algoviz inspect <file> [frame …]
 *   algoviz render <file> [--frame f] [--theme t] [--layout narrow]
 *                  [--out frame.svg]
 *   algoviz export <file> [--step s …] [--theme t] [--layout l] [--format svg|tikz]
 *                  [--one-file] [--out dir] [--name pattern]
 *                  [--error-file file]
 *   algoviz export <id> --input <input|file> [the same options]
 *   algoviz export <id> --input-hex <hex> [the same options]
 *
 *   algoviz recipes
 *   algoviz run <id> [input] [--out doc.json]
 *
 * An input is JSON, a JSON object without its braces, or a notation such
 * as "5 2 4 6 1 3" or "A-B 4, B-C 2" (ADR 0032).
 *
 * A frame is a number (negative counts from the end) or a selector such as
 * "relax#2", "insert-5/go" or "insert-5" (ADR 0020).
 *
 * A file of "-" is read from standard input. Exits with 1 on an error.
 */
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';

import type { FigureLayout } from '@algoviz/core';
import { readInput, runAlgorithm } from '@algoviz/recipes';
import { formatErrors, ok, type Diagnostic, type Result } from '@algoviz/spec';
import {
  exportFigures,
  isThemeName,
  themeNames,
  type ThemeName,
} from '@algoviz/svg';
import { exportTikzFigures } from '@algoviz/tikz';

import { readDocument } from './document.ts';
import {
  DEFAULT_PATTERN,
  FORMAT_EXTENSIONS,
  ONE_FILE_PATTERN,
  figureFiles,
  patternProblem,
  type FigureFormat,
} from './export.ts';
import { callTool, type ToolResult } from './tools.ts';

const USAGE = `Usage:
  algoviz guide [kind …]                 Authoring guide (all kinds by default)
  algoviz validate <file>                Check a document
  algoviz inspect <file> [frame …]       State at frames (default: the last)
  algoviz render <file> [--frame f] [--theme t]
                 [--layout wide|narrow] [--out file.svg]
  algoviz export <file> [--step s …] [--theme t]
                 [--layout wide|narrow] [--format svg|tikz] [--one-file]
                 [--out dir]
                 [--name pattern] [--error-file file]
                                         Write frames as SVG or TikZ figures
  algoviz export <id> --input <input|file> [the same options]
                                         Run an algorithm, then export
  algoviz recipes                        List ready-made visualizations
  algoviz run <id> [input] [--out file.json]
                                         Run one, e.g. run dijkstra
                                         'A-B 4, B-C 1, A-C 7'

An input is JSON, a JSON object without its outer braces, or a notation:
a list "5 2 4 6 1 3", a graph "A-B 4, B-C 2" ("->" for directed edges),
or operations "insert 4, delete 3". An input may be its main field alone,
such as a sort's values or a graph algorithm's graph, and without one an
algorithm runs on its first example. --input also takes a file.

A frame is a number (0 the start, -1 the last), a step such as "relax#2"
or "insert-5/relax", a section such as "insert-5", or a range "a..b".
Render takes one frame. Export takes any number: --step may repeat or list
them with commas, and every frame is the default. It names files with
{name}, {frame} and {step} (default "${DEFAULT_PATTERN}") and writes them to the
--out directory (default: the current one). --format tikz writes .tex files
for the algoviz LaTeX package, and --one-file writes all of them into one
file, named "{name}" by default, for Beamer overlays. --layout says where
structures declared with "place": "side" go: beside the others (wide, the
default) or below them (narrow, for a column of notes). --input-hex takes the
input as hexadecimal UTF-8, for programs that cannot quote JSON for a shell,
and --error-file also writes any error to a file, which a successful export
removes. --theme picks a built-in theme: ${themeNames.join(', ')}; light is
the default.`;

class UsageError extends Error {}

function readText(file: string, hint = ''): string {
  try {
    return readFileSync(file === '-' ? 0 : file, 'utf8');
  } catch (e) {
    throw new UsageError(
      `Cannot read ${file}: ${e instanceof Error ? e.message : String(e)}${hint}`,
    );
  }
}

interface Options {
  frame?: string;
  theme?: string;
  layout?: string;
  out?: string;
  /** Export only: selectors, each possibly a comma-separated list. */
  step?: string[];
  input?: string;
  inputHex?: string;
  name?: string;
  format?: string;
  errorFile?: string;
  /** Export only: every figure in one TikZ file (ADR 0028). */
  oneFile?: boolean;
  help?: boolean;
}

/** Options that only `export` takes. */
const EXPORT_ONLY = {
  step: '--step',
  input: '--input',
  inputHex: '--input-hex',
  name: '--name',
  format: '--format',
  errorFile: '--error-file',
  oneFile: '--one-file',
};

/**
 * A small argument parser: node:util's parseArgs would read frame numbers
 * such as -1 as options.
 */
function parse(argv: readonly string[]) {
  const values: Options = {};
  const positionals: string[] = [];
  for (let k = 0; k < argv.length; k++) {
    const arg = argv[k]!;
    const [flag, inline] = arg.split(/=(.*)/s, 2) as [string, string?];
    const take = () => {
      const value = inline ?? argv[++k];
      if (value === undefined) throw new UsageError(`${flag} needs a value`);
      return value;
    };
    if (flag === '--frame') values.frame = take();
    else if (flag === '--step') values.step = [...(values.step ?? []), take()];
    else if (flag === '--input') values.input = take();
    else if (flag === '--input-hex') values.inputHex = take();
    else if (flag === '--format') values.format = take();
    else if (flag === '--error-file') values.errorFile = take();
    else if (flag === '--name') values.name = take();
    else if (flag === '--theme') values.theme = take();
    else if (flag === '--layout') values.layout = take();
    else if (flag === '--out' || flag === '-o') values.out = take();
    else if (arg === '--one-file') values.oneFile = true;
    else if (arg === '--help' || arg === '-h') values.help = true;
    else if (/^-(?!\d)./.test(arg))
      throw new UsageError(`Unknown option ${arg}`);
    else positionals.push(arg);
  }
  return { values, positionals };
}

function run(argv: readonly string[]): {
  result: ToolResult;
  outFile?: string | undefined;
} {
  const { values, positionals } = parse(argv);
  const [command, ...rest] = positionals;
  if (values.help || command === undefined) return { result: { text: USAGE } };
  if (command === 'export') return { result: exportCommand(rest, values) };
  for (const [key, flag] of Object.entries(EXPORT_ONLY))
    if (values[key as keyof typeof EXPORT_ONLY] !== undefined)
      throw new UsageError(`${flag} only applies to export`);
  if (values.layout !== undefined && command !== 'render')
    throw new UsageError('--layout only applies to export and render');
  return { result: dispatch(command, rest, values), outFile: values.out };
}

const failure = (errors: readonly Diagnostic[]): ToolResult => ({
  text: formatErrors(errors),
  isError: true,
});

const LAYOUTS: readonly FigureLayout[] = ['wide', 'narrow'];

/** The layout a flag names, wide by default (ADR 0029). */
function layoutOf(name: string | undefined): FigureLayout {
  const layout = name ?? 'wide';
  if (!(LAYOUTS as readonly string[]).includes(layout))
    throw new UsageError(
      `Unknown layout "${layout}"; use ${LAYOUTS.join(', ')}`,
    );
  return layout as FigureLayout;
}

/**
 * Text from hexadecimal UTF-8, as the LaTeX package passes input: digits
 * and letters only, so no shell can read anything into it.
 */
export function fromHex(hex: string): string {
  if (!/^(?:[0-9a-f]{2})*$/i.test(hex))
    throw new UsageError(
      '--input-hex takes an even number of hexadecimal digits',
    );
  try {
    return decodeURIComponent(hex.replace(/../g, '%$&'));
  } catch {
    throw new UsageError('--input-hex is not UTF-8 text');
  }
}

/**
 * The text of the input given with `--input` or `--input-hex` (ADR 0032):
 * the argument itself if it starts with { or [; a file's if it names one,
 * as "-" and names ending in .json always do; else the argument.
 */
function inputText(values: Options): string {
  if (values.inputHex !== undefined) return fromHex(values.inputHex);
  const input = values.input!;
  if (/^\s*[[{]/.test(input)) return input;
  if (input === '-' || /\.json$/i.test(input)) return readText(input);
  try {
    return readFileSync(input, 'utf8');
  } catch {
    return input;
  }
}

/** The document to export: a file's, or an algorithm's run on its input. */
function exportSource(
  source: string,
  values: Options,
): Result<unknown, readonly Diagnostic[]> {
  if (values.input === undefined && values.inputHex === undefined)
    return readDocument(
      readText(
        source,
        '\nTo run an algorithm, name its input with --input <json|file>.',
      ),
    );
  const value = readInput(inputText(values));
  if (!value.ok) return value;
  const run = runAlgorithm(source, value.value);
  return run.ok ? ok(run.value.document) : run;
}

const isFormat = (name: string): name is FigureFormat =>
  Object.hasOwn(FORMAT_EXTENSIONS, name);

/** A figure in some format: its frame, its selector and its file's text. */
interface FormattedFigure {
  readonly frame: number;
  readonly selector: string;
  readonly text: string;
}

/** The figures of a series in one format, as files are written from them. */
function exportSeries(
  document: unknown,
  options: {
    steps: readonly string[];
    theme: ThemeName;
    layout: FigureLayout;
  },
  format: FigureFormat,
): Result<
  { readonly frames: number; readonly figures: readonly FormattedFigure[] },
  readonly Diagnostic[]
> {
  const series =
    format === 'svg'
      ? exportFigures(document, options)
      : exportTikzFigures(document, options);
  if (!series.ok) return series;
  return ok({
    frames: series.value.frames,
    figures: series.value.figures.map((f) => ({
      frame: f.frame,
      selector: f.selector,
      text: 'svg' in f ? f.svg : f.tikz,
    })),
  });
}

/**
 * Writes the chosen frames as SVG or TikZ figures (ADR 0025, 0027), and
 * lists each file with its frame's selector. Nothing is written unless all
 * of them render.
 */
function exportCommand(rest: readonly string[], values: Options): ToolResult {
  if (values.frame !== undefined)
    throw new UsageError('export selects frames with --step, not --frame');
  const [source, extra] = rest;
  if (source === undefined)
    throw new UsageError('export needs a file, or an algorithm id and --input');
  if (extra !== undefined)
    throw new UsageError(`export takes one file, not also "${extra}"`);
  const theme = values.theme ?? 'light';
  if (!isThemeName(theme))
    throw new UsageError(
      `Unknown theme "${theme}"; use ${themeNames.join(', ')}`,
    );
  const layout = layoutOf(values.layout);
  const format = values.format ?? 'svg';
  if (!isFormat(format))
    throw new UsageError(`Unknown format "${format}"; use svg or tikz`);
  if (values.input !== undefined && values.inputHex !== undefined)
    throw new UsageError(
      'Give the input with --input or --input-hex, not both',
    );
  const out = values.out ?? '.';
  if (/\.(?:svg|tex)$/i.test(out))
    throw new UsageError(
      `--out names a directory, not a file such as "${out}"; name the files with --name`,
    );
  const oneFile = values.oneFile === true;
  const pattern = values.name ?? (oneFile ? ONE_FILE_PATTERN : DEFAULT_PATTERN);
  const problem = patternProblem(pattern, format, oneFile);
  if (problem !== undefined) throw new UsageError(problem);

  const document = exportSource(source, values);
  if (!document.ok) return failure(document.error);
  const steps = (values.step ?? []).flatMap((s) =>
    s.split(',').map((part) => part.trim()),
  );
  const series = exportSeries(document.value, { steps, theme, layout }, format);
  if (!series.ok) return failure(series.error);
  const name =
    values.input !== undefined || values.inputHex !== undefined
      ? source
      : source === '-'
        ? 'figure'
        : basename(source, extname(source));
  const files = figureFiles(series.value, {
    name,
    pattern,
    format,
    oneFile,
  });
  if (!files.ok) throw new UsageError(files.error);

  // The figures of each file, in timeline order: one per file, or every
  // figure in one with --one-file.
  const contents = new Map<string, string[]>();
  for (const { file, figure } of files.value)
    contents.set(file, [
      ...(contents.get(file) ?? []),
      figure.text.replace(/\n$/, ''),
    ]);
  try {
    mkdirSync(out, { recursive: true });
    for (const [file, texts] of contents) {
      const path = join(out, file);
      // A whole file or none: the LaTeX package takes a figure file that
      // exists for a finished one. Blank lines separate the figures.
      const partial = `${path}.part`;
      writeFileSync(partial, `${texts.join('\n\n')}\n`);
      renameSync(partial, path);
    }
    const lines = files.value.map(
      ({ file, figure }) => `${join(out, file)}  ${figure.selector}`,
    );
    return { text: lines.join('\n') };
  } catch (e) {
    return {
      text: `Cannot write to ${out}: ${e instanceof Error ? e.message : String(e)}`,
      isError: true,
    };
  }
}

function dispatch(
  command: string,
  rest: readonly string[],
  values: {
    frame?: string | undefined;
    theme?: string | undefined;
    layout?: string | undefined;
  },
): ToolResult {
  const file = rest[0];
  const needFile = () => {
    if (file === undefined) throw new UsageError(`${command} needs a file`);
    return readText(file);
  };
  switch (command) {
    case 'guide':
      return callTool('algoviz_guide', rest.length > 0 ? { kinds: rest } : {});
    case 'validate':
      return callTool('algoviz_validate', { document: needFile() });
    case 'inspect': {
      // Numbers stay text: selectors read "-1" as well as "relax#2".
      const frames = rest.slice(1);
      return callTool('algoviz_inspect', {
        document: needFile(),
        ...(frames.length > 0 ? { frames } : {}),
      });
    }
    case 'render':
      return callTool('algoviz_render', {
        document: needFile(),
        ...(values.frame === undefined ? {} : { frame: values.frame }),
        ...(values.theme === undefined ? {} : { theme: values.theme }),
        ...(values.layout === undefined
          ? {}
          : { layout: layoutOf(values.layout) }),
      });
    case 'recipes':
      return callTool('algoviz_list_recipes', {});
    case 'run': {
      const [id, text] = rest;
      if (id === undefined) throw new UsageError(`${command} needs an id`);
      const input = readInput(text ?? '');
      if (!input.ok) return failure(input.error);
      return callTool('algoviz_run_recipe', { id, input: input.value });
    }
    default:
      throw new UsageError(`Unknown command "${command}"`);
  }
}

/**
 * The value of `--error-file`, read before anything else can fail, so even
 * a usage error reaches it.
 */
function errorFileOf(argv: readonly string[]): {
  readonly file?: string;
  /** The file is also another argument, such as the document or input. */
  readonly clash: boolean;
} {
  let file: string | undefined;
  let at = -1;
  argv.forEach((arg, k) => {
    if (arg === '--error-file') [file, at] = [argv[k + 1], k + 1];
    else if (arg.startsWith('--error-file=')) [file, at] = [arg.slice(13), k];
  });
  if (file === undefined || file === '') return { clash: false };
  const others = argv
    .filter((_, k) => k !== at)
    .map((arg) => arg.replace(/^--[\w-]+=/, ''));
  return others.includes(file) ? { clash: true } : { file, clash: false };
}

/**
 * Keeps `--error-file` in step with the run: the message of a failure, or
 * no file after a success. A file that cannot be written leaves the
 * message on standard error alone.
 */
function recordError(file: string | undefined, message: string | undefined) {
  if (file === undefined) return;
  try {
    if (message === undefined) rmSync(file, { force: true });
    else {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, `${message}\n`);
    }
  } catch {
    // Standard error has the message anyway.
  }
}

/**
 * Runs the CLI and returns the exit code; the output goes to `out` unless
 * `--out` names a file.
 */
export function main(
  argv: readonly string[],
  out: (text: string) => void = (text) => process.stdout.write(`${text}\n`),
  err: (text: string) => void = (text) => process.stderr.write(`${text}\n`),
): number {
  const { file: errorFile, clash } = errorFileOf(argv);
  if (clash) {
    // Writing the message there would replace a file the command reads.
    err(`--error-file names a file the command reads or writes\n\n${USAGE}`);
    return 2;
  }
  let ran: ReturnType<typeof run>;
  try {
    ran = run(argv);
  } catch (e) {
    // SyntaxError: an input that is not JSON.
    if (!(e instanceof UsageError || e instanceof SyntaxError)) {
      // A bug: the error file says so, and the exception goes on up.
      recordError(
        errorFile,
        `Internal error in algoviz: ${e instanceof Error ? e.message : String(e)}`,
      );
      throw e;
    }
    recordError(errorFile, e.message);
    err(`${e.message}\n\n${USAGE}`);
    return 2;
  }
  const { result, outFile } = ran;
  if (result.isError) {
    recordError(errorFile, result.text);
    err(result.text);
    return 1;
  }
  if (outFile !== undefined)
    try {
      writeFileSync(outFile, `${result.text}\n`);
    } catch (e) {
      const message = `Cannot write to ${outFile}: ${e instanceof Error ? e.message : String(e)}`;
      recordError(errorFile, message);
      err(message);
      return 1;
    }
  else out(result.text);
  recordError(errorFile, undefined);
  return 0;
}
