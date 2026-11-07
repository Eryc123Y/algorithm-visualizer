/**
 * The MCP tools as a command line, for people and for agents that run
 * commands rather than MCP tools:
 *
 *   algoviz guide [kind …]
 *   algoviz validate <file>
 *   algoviz inspect <file> [frame …]
 *   algoviz render <file> [--frame f] [--theme dark] [--out frame.svg]
 *
 * A frame is a number (negative counts from the end) or a selector such as
 * "relax#2", "insert-5/go" or "insert-5" (ADR 0020).
 *   algoviz recipes
 *   algoviz recipe <name> <args-json> [--out doc.json]
 *
 * A file of "-" is read from standard input. Exits with 1 on an error.
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { callTool, type ToolResult } from './tools.ts';

const USAGE = `Usage:
  algoviz guide [kind …]                 Authoring guide (all kinds by default)
  algoviz validate <file>                Check a document
  algoviz inspect <file> [frame …]       State at frames (default: the last)
  algoviz render <file> [--frame f] [--theme light|dark] [--out file.svg]
  algoviz recipes                        List ready-made visualizations
  algoviz recipe <name> <args-json> [--out file.json]

A frame is a number (0 the start, -1 the last), a step such as "relax#2"
or "insert-5/relax", a section such as "insert-5", or a range "a..b".
Render takes one frame.`;

class UsageError extends Error {}

function readText(file: string): string {
  try {
    return readFileSync(file === '-' ? 0 : file, 'utf8');
  } catch (e) {
    throw new UsageError(
      `Cannot read ${file}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

interface Options {
  frame?: string;
  theme?: string;
  out?: string;
  help?: boolean;
}

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
  return { result: dispatch(command, rest, values), outFile: values.out };
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
    case 'recipe': {
      const [name, args = '{}'] = rest;
      if (name === undefined) throw new UsageError('recipe needs a name');
      return callTool('algoviz_run_recipe', {
        name,
        args: JSON.parse(args) as unknown,
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
    // SyntaxError: recipe arguments that are not JSON.
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
