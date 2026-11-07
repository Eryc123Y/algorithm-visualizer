/**
 * The MCP tools as a command line, for people and for agents that run
 * commands rather than MCP tools:
 *
 *   algoviz guide [kind …]
 *   algoviz validate <file>
 *   algoviz inspect <file> [frame …]
 *   algoviz render <file> [--frame f] [--theme dark] [--out frame.svg]
 *   algoviz export <file> [--step s …] [--theme t] [--out dir] [--name pattern]
 *   algoviz export <id> --input <json|file> [the same options]
 *
 *   algoviz recipes
 *   algoviz run <id> <input-json> [--out doc.json]
 *
 * A frame is a number (negative counts from the end) or a selector such as
 * "relax#2", "insert-5/go" or "insert-5" (ADR 0020).
 *
 * A file of "-" is read from standard input. Exits with 1 on an error.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

import { runAlgorithm } from '@algoviz/recipes';
import { formatErrors, ok, type Diagnostic, type Result } from '@algoviz/spec';
import { exportFigures, themes, type ThemeName } from '@algoviz/svg';

import { readDocument } from './document.ts';
import { DEFAULT_PATTERN, figureFiles, patternProblem } from './export.ts';
import { callTool, type ToolResult } from './tools.ts';

const USAGE = `Usage:
  algoviz guide [kind …]                 Authoring guide (all kinds by default)
  algoviz validate <file>                Check a document
  algoviz inspect <file> [frame …]       State at frames (default: the last)
  algoviz render <file> [--frame f] [--theme light|dark] [--out file.svg]
  algoviz export <file> [--step s …] [--theme light|dark|print]
                 [--out dir] [--name pattern]
                                         Write frames as SVG figures
  algoviz export <id> --input <json|file> [the same options]
                                         Run an algorithm, then export
  algoviz recipes                        List ready-made visualizations
  algoviz run <id> <input-json> [--out file.json]
                                         Run one, e.g. run bst.delete
                                         '{"from": [8, 3, 10], "key": 3}'

A frame is a number (0 the start, -1 the last), a step such as "relax#2"
or "insert-5/relax", a section such as "insert-5", or a range "a..b".
Render takes one frame. Export takes any number: --step may repeat or list
them with commas, and every frame is the default. It names files with
{name}, {frame} and {step} (default "${DEFAULT_PATTERN}") and writes them to the
--out directory (default: the current one).`;

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
  out?: string;
  /** Export only: selectors, each possibly a comma-separated list. */
  step?: string[];
  input?: string;
  name?: string;
  help?: boolean;
}

/** Options that only `export` takes. */
const EXPORT_ONLY = { step: '--step', input: '--input', name: '--name' };

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
    else if (flag === '--name') values.name = take();
    else if (flag === '--theme') values.theme = take();
    else if (flag === '--out' || flag === '-o') values.out = take();
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
  return { result: dispatch(command, rest, values), outFile: values.out };
}

const failure = (errors: readonly Diagnostic[]): ToolResult => ({
  text: formatErrors(errors),
  isError: true,
});

const isThemeName = (name: string): name is ThemeName =>
  Object.hasOwn(themes, name);

/** The document to export: a file's, or an algorithm's run on `--input`. */
function exportSource(
  source: string,
  input: string | undefined,
): Result<unknown, readonly Diagnostic[]> {
  if (input === undefined)
    return readDocument(
      readText(
        source,
        '\nTo run an algorithm, name its input with --input <json|file>.',
      ),
    );
  const text = /^\s*[[{]/.test(input)
    ? input
    : readText(
        input,
        '\n--input takes JSON text that starts with { or [, or a JSON file.',
      );
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (e) {
    throw new UsageError(
      `The input is not JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const run = runAlgorithm(source, value);
  return run.ok ? ok(run.value.document) : run;
}

/**
 * Writes the chosen frames as SVG figures (ADR 0025), and lists each file
 * with its frame's selector. Nothing is written unless all of them render.
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
      `Unknown theme "${theme}"; use ${Object.keys(themes).join(', ')}`,
    );
  const out = values.out ?? '.';
  if (/\.svg$/i.test(out))
    throw new UsageError(
      `--out names a directory, not a file such as "${out}"; name the files with --name`,
    );
  const pattern = values.name ?? DEFAULT_PATTERN;
  const problem = patternProblem(pattern);
  if (problem !== undefined) throw new UsageError(problem);

  const document = exportSource(source, values.input);
  if (!document.ok) return failure(document.error);
  const steps = (values.step ?? []).flatMap((s) =>
    s.split(',').map((part) => part.trim()),
  );
  const series = exportFigures(document.value, { steps, theme });
  if (!series.ok) return failure(series.error);
  const name =
    values.input !== undefined
      ? source
      : source === '-'
        ? 'figure'
        : basename(source, extname(source));
  const files = figureFiles(series.value, { name, pattern });
  if (!files.ok) throw new UsageError(files.error);

  try {
    mkdirSync(out, { recursive: true });
    const lines = files.value.map(({ file, figure }) => {
      const path = join(out, file);
      writeFileSync(path, `${figure.svg}\n`);
      return `${path}  ${figure.selector}`;
    });
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
  values: { frame?: string | undefined; theme?: string | undefined },
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
      });
    case 'recipes':
      return callTool('algoviz_list_recipes', {});
    case 'run': {
      const [id, input] = rest;
      if (id === undefined || input === undefined)
        throw new UsageError(`${command} needs an id and an input`);
      return callTool('algoviz_run_recipe', {
        id,
        input: JSON.parse(input) as unknown,
      });
    }
    default:
      throw new UsageError(`Unknown command "${command}"`);
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
  let ran: ReturnType<typeof run>;
  try {
    ran = run(argv);
  } catch (e) {
    // SyntaxError: an input that is not JSON.
    if (!(e instanceof UsageError || e instanceof SyntaxError)) throw e;
    err(`${e.message}\n\n${USAGE}`);
    return 2;
  }
  const { result, outFile } = ran;
  if (result.isError) {
    err(result.text);
    return 1;
  }
  if (outFile === undefined) out(result.text);
  else writeFileSync(outFile, `${result.text}\n`);
  return 0;
}
