/**
 * The tools of the MCP server as commands, for agents that run shell
 * commands (e.g. coding agents) instead of calling MCP tools. Every call is
 * logged to the run directory, like the API runner's calls.
 *
 *   node --conditions=@algomotion/source evals/src/agent.ts <run> <task> guide [kind …]
 *   … <run> <task> validate <file>
 *   … <run> <task> inspect <file> [frame …]
 *   … <run> <task> submit <file>
 */
import { readFileSync } from 'node:fs';

import type { ToolResult } from '@algomotion/mcp';

import { findTask } from './tasks.ts';
import { loggedCall, submit } from './log.ts';

const [run, task, command, ...rest] = process.argv.slice(2);

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

if (run === undefined || task === undefined || command === undefined)
  fail('Usage: agent.ts <run-dir> <task-id> guide|validate|inspect|submit …');
if (findTask(task) === undefined) fail(`Unknown task "${task}"`);

const file = () => {
  const path = rest[0] ?? fail(`${command} needs a file`);
  try {
    return readFileSync(path, 'utf8');
  } catch (e) {
    return fail(`Cannot read ${path}: ${(e as Error).message}`);
  }
};

let result: ToolResult;
switch (command) {
  case 'guide':
    result = loggedCall(
      run,
      task,
      'algomotion_guide',
      rest.length > 0 ? { kinds: rest } : {},
    );
    break;
  case 'validate':
    result = loggedCall(run, task, 'algomotion_validate', { document: file() });
    break;
  case 'inspect': {
    const frames = rest.slice(1).map(Number);
    result = loggedCall(run, task, 'algomotion_inspect', {
      document: file(),
      ...(frames.length > 0 ? { frames } : {}),
    });
    break;
  }
  case 'submit':
    submit(run, task, file());
    result = { text: 'Submitted.' };
    break;
  default:
    fail(`Unknown command "${command}"`);
}
process.stdout.write(`${result.text}\n`);
process.exitCode = result.isError ? 1 : 0;
