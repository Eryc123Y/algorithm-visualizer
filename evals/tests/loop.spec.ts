import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

import { readLog, writeMeta } from '../src/log.ts';
import {
  apiTools,
  attempt,
  extractJson,
  type CreateMessage,
} from '../src/loop.ts';
import { formatRun, summarizeRun } from '../src/report.ts';
import { findTask } from '../src/tasks.ts';
import { references } from './references.ts';

const task = findTask('printer-queue')!;
const good = references['printer-queue']!();
const bad = {
  ...good,
  steps: [{ actions: [{ target: 'q', type: 'dequeue' }] }],
};

/** A model that replies with the given content blocks, one turn each. */
function scripted(turns: Anthropic.ContentBlock[][]) {
  const requests: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const create: CreateMessage = (params) => {
    requests.push(structuredClone(params));
    const content = turns.shift() ?? [];
    return Promise.resolve({
      id: 'msg',
      type: 'message',
      role: 'assistant',
      model: params.model,
      content,
      stop_reason: content.some((b) => b.type === 'tool_use')
        ? 'tool_use'
        : 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_read_input_tokens: 100,
        cache_creation_input_tokens: 0,
      },
    } as unknown as Anthropic.Message);
  };
  return { create, requests };
}

const use = (id: string, name: string, input: unknown) =>
  ({ type: 'tool_use', id, name, input }) as Anthropic.ContentBlock;
const text = (t: string) =>
  ({ type: 'text', text: t, citations: null }) as Anthropic.ContentBlock;

const newRun = () => mkdtempSync(join(tmpdir(), 'algomotion-eval-'));

describe('attempt with tools', () => {
  it('runs tools until the document is submitted, logging each call', async () => {
    const run = newRun();
    const { create, requests } = scripted([
      [use('1', 'algomotion_guide', { kinds: ['queue'] })],
      [use('2', 'algomotion_validate', { document: bad })],
      [use('3', 'algomotion_validate', { document: good })],
      [use('4', 'submit_document', { document: good })],
    ]);
    const result = await attempt(task, run, create, {
      model: 'm',
      mode: 'tools',
    });
    expect(result.stop).toBe('submitted');
    expect(result.turns).toBe(4);
    expect(result.usage).toEqual({
      input: 40,
      output: 20,
      cacheRead: 400,
      cacheWrite: 0,
    });
    expect(readLog(run, task.id).map((e) => [e.tool, e.ok, e.codes])).toEqual([
      ['algomotion_guide', true, undefined],
      ['algomotion_validate', false, ['EMPTY']],
      ['algomotion_validate', true, undefined],
      ['submit', true, undefined],
    ]);
    expect(
      JSON.parse(readFileSync(join(run, `${task.id}.json`), 'utf8')),
    ).toEqual(good);

    // Tool results go back to the model, errors flagged.
    const last = requests.at(-1)!.messages.at(-1)!;
    expect(last.role).toBe('user');
    const [validation] = requests[2]!.messages.at(-1)!
      .content as Anthropic.ToolResultBlockParam[];
    expect(validation!.is_error).toBe(true);
    expect(validation!.content).toContain('EMPTY at $.steps[0].actions[0]');

    const summary = summarizeRun(run);
    expect(summary.totals).toMatchObject({
      correct: 1,
      valid: 1,
      firstValid: 0,
      validated: 1,
    });
    expect(summary.tasks[0]!.invalidValidations).toBe(1);
    expect(summary.errorCodes).toEqual([['EMPTY', 1]]);
    expect(formatRun(summary)).toContain('| Correct | 100% (1/1) |');
  });

  it('offers the tools without render and recipes by default', () => {
    expect(apiTools(false).map((t) => t.name)).toEqual([
      'algomotion_guide',
      'algomotion_validate',
      'algomotion_inspect',
      'submit_document',
    ]);
    expect(apiTools(true).map((t) => t.name)).toContain(
      'algomotion_run_recipe',
    );
    for (const t of apiTools(true)) {
      expect(t.input_schema.type).toBe('object');
      expect(t.input_schema).not.toHaveProperty('$schema');
    }
  });

  it('takes a document from a final reply without a submission', async () => {
    const run = newRun();
    const { create } = scripted([
      [text(`Here:\n\`\`\`json\n${JSON.stringify(good)}\n\`\`\``)],
    ]);
    const result = await attempt(task, run, create, {
      model: 'm',
      mode: 'tools',
    });
    expect(result.stop).toBe('answered');
    expect(summarizeRun(run).tasks[0]!.valid).toBe(true);
  });

  it('records a reply without a document', async () => {
    const run = newRun();
    const { create } = scripted([[text('I cannot do that.')]]);
    const result = await attempt(task, run, create, {
      model: 'm',
      mode: 'tools',
    });
    expect(result.stop).toBe('no_submission');
    expect(summarizeRun(run).tasks[0]!.submitted).toBe(false);
  });

  it('counts a task the run was given that left nothing behind', async () => {
    const run = newRun();
    const { create } = scripted([
      [text(`\`\`\`json\n${JSON.stringify(good)}\n\`\`\``)],
    ]);
    writeMeta(run, {
      model: 'm',
      mode: 'tools',
      date: '2026-01-01',
      tasks: [task.id, 'dijkstra'],
    });
    await attempt(task, run, create, { model: 'm', mode: 'tools' });
    // dijkstra failed before its first log entry, e.g. on an API error.
    const { totals, tasks } = summarizeRun(run);
    expect(Object.fromEntries(tasks.map((t) => [t.task, t.correct]))).toEqual({
      'printer-queue': true,
      dijkstra: false,
    });
    expect([totals.tasks, totals.correct]).toEqual([2, 1]);
  });

  it('answers a submission without a document with an error', async () => {
    const run = newRun();
    const { create, requests } = scripted([
      [use('1', 'submit_document', {})],
      [use('2', 'submit_document', { document: good })],
    ]);
    const result = await attempt(task, run, create, {
      model: 'm',
      mode: 'tools',
    });
    expect(result.stop).toBe('submitted');
    const reply = requests[1]!.messages.at(-1)!.content as {
      is_error?: boolean;
    }[];
    expect(reply[0]!.is_error).toBe(true);
    expect(summarizeRun(run).tasks[0]!.correct).toBe(true);
  });

  it('stops after the turn limit', async () => {
    const run = newRun();
    const { create } = scripted(
      Array.from({ length: 5 }, (_, k) => [
        use(String(k), 'algomotion_guide', {}),
      ]),
    );
    const result = await attempt(task, run, create, {
      model: 'm',
      mode: 'tools',
      maxTurns: 3,
    });
    expect(result.stop).toBe('max_turns');
  });
});

describe('attempt in one shot', () => {
  it('sends the guide and takes the document from the reply', async () => {
    const run = newRun();
    const { create, requests } = scripted([
      [text(`\`\`\`json\n${JSON.stringify(good)}\n\`\`\``)],
    ]);
    const result = await attempt(task, run, create, {
      model: 'm',
      mode: 'oneshot',
      effort: 'low',
    });
    expect(result.stop).toBe('answered');
    expect(requests[0]!.tools).toBeUndefined();
    expect(requests[0]!.system).toContain('## hashTable');
    expect(requests[0]!.output_config).toEqual({ effort: 'low' });
    expect(summarizeRun(run).tasks[0]!.correct).toBe(true);
  });
});

describe('extractJson', () => {
  it('reads a fenced block or bare JSON', () => {
    expect(extractJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(extractJson('{"a": 1}')).toEqual({ a: 1 });
    expect(extractJson('no json')).toBeUndefined();
  });
});
