/**
 * Runs the eval tasks against a Claude model through the API.
 *
 *   node --conditions=@algoviz/source evals/src/run.ts [options]
 *
 *   --model <id>         default claude-opus-5-5
 *   --mode tools|oneshot tools (default): the MCP tools in an agent loop;
 *                        oneshot: the guide in the prompt, one reply
 *   --effort <level>     low, medium, high, xhigh or max (model default if unset)
 *   --tasks <a,b,…>      task ids (default: all)
 *   --recipes            also offer the recipe tools
 *   --concurrency <n>    tasks at a time (default 4)
 *   --out <dir>          default evals/results/<model>-<mode>-<time>
 *
 * Credentials come from the environment as for any Anthropic SDK client
 * (ANTHROPIC_API_KEY, or a profile from `ant auth login`).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import Anthropic from '@anthropic-ai/sdk';

import { writeMeta } from './log.ts';
import { attempt, type AttemptOptions, type AttemptResult } from './loop.ts';
import { formatRun, writeReport } from './report.ts';
import { tasks } from './tasks.ts';

const { values } = parseArgs({
  options: {
    model: { type: 'string', default: 'claude-opus-5-5' },
    mode: { type: 'string', default: 'tools' },
    effort: { type: 'string' },
    tasks: { type: 'string' },
    recipes: { type: 'boolean', default: false },
    concurrency: { type: 'string', default: '4' },
    out: { type: 'string' },
  },
});

const mode = values.mode === 'oneshot' ? 'oneshot' : 'tools';
const efforts = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
const effort = efforts.find((e) => e === values.effort);
if (values.effort !== undefined && effort === undefined)
  throw new Error(`--effort must be one of ${efforts.join(', ')}`);
const concurrency = Number(values.concurrency);
if (!Number.isInteger(concurrency) || concurrency < 1)
  throw new Error('--concurrency must be a positive integer');
const requested = values.tasks?.split(',').map((id) => id.trim());
const unknown = requested?.filter((id) => !tasks.some((t) => t.id === id));
if (unknown !== undefined && unknown.length > 0)
  throw new Error(`Unknown task ids: ${unknown.join(', ')}`);
const chosen = requested
  ? tasks.filter((t) => requested.includes(t.id))
  : tasks;
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const run =
  values.out ?? join('evals', 'results', `${values.model}-${mode}-${stamp}`);

const options: AttemptOptions = {
  model: values.model,
  mode,
  recipes: values.recipes,
  ...(effort ? { effort } : {}),
};

const client = new Anthropic();
const create = (params: Anthropic.MessageCreateParamsNonStreaming) =>
  // Streamed, so long replies do not hit request timeouts.
  client.messages.stream(params).finalMessage();

writeMeta(run, {
  model: values.model,
  mode,
  date: new Date().toISOString(),
  notes: [effort && `effort ${effort}`, values.recipes && 'with recipes']
    .filter(Boolean)
    .join(', '),
  tasks: chosen.map((t) => t.id),
});

const queue = [...chosen];
const results = new Map<string, AttemptResult | Error>();
async function worker() {
  for (let task = queue.shift(); task; task = queue.shift()) {
    try {
      const result = await attempt(task, run, create, options);
      results.set(task.id, result);
      mkdirSync(join(run, 'transcripts'), { recursive: true });
      writeFileSync(
        join(run, 'transcripts', `${task.id}.json`),
        JSON.stringify(result, null, 2),
      );
      console.log(`${task.id}: ${result.stop} after ${result.turns} turns`);
    } catch (e) {
      // An API error fails the task, not the run.
      results.set(task.id, e as Error);
      console.error(`${task.id}: ${(e as Error).message}`);
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));

const summary = writeReport(run);
const usage = [...results.values()].reduce(
  (sum, r) =>
    r instanceof Error
      ? sum
      : {
          input: sum.input + r.usage.input,
          output: sum.output + r.usage.output,
          cacheRead: sum.cacheRead + r.usage.cacheRead,
        },
  { input: 0, output: 0, cacheRead: 0 },
);
console.log(formatRun(summary));
console.log(
  `Tokens: ${usage.input} input, ${usage.cacheRead} cache reads, ${usage.output} output. Results in ${run}`,
);
