/**
 * One task attempted by a model through the Claude API, either with the
 * MCP tools in an agent loop, or in one shot with the guide in the prompt.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { guide, INSTRUCTIONS, tools, visualizeRequest } from '@algoviz/mcp';
import { z } from 'zod';

import { appendLog, loggedCall, submit } from './log.ts';
import type { EvalTask } from './tasks.ts';

/** Sends one request; the runner streams it, tests script it. */
export type CreateMessage = (
  params: Anthropic.MessageCreateParamsNonStreaming,
) => Promise<Anthropic.Message>;

export interface AttemptOptions {
  readonly model: string;
  readonly mode: 'tools' | 'oneshot';
  readonly effort?: Anthropic.OutputConfig['effort'];
  /** Offer the recipe tools too (default false: measure writing documents). */
  readonly recipes?: boolean;
  readonly maxTurns?: number;
  readonly maxTokens?: number;
}

export type Stop =
  | 'submitted'
  | 'answered'
  | 'no_submission'
  | 'max_turns'
  | 'max_tokens'
  | 'refusal';

export interface AttemptResult {
  readonly stop: Stop;
  readonly turns: number;
  readonly usage: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  readonly transcript: Anthropic.MessageParam[];
}

const SUBMIT = 'submit_document';

const submitTool: Anthropic.Tool = {
  name: SUBMIT,
  description:
    'Hands in the finished visualization document. Call it once, with the validated document.',
  input_schema: {
    type: 'object',
    properties: {
      document: {
        type: 'object',
        description: 'The visualization document.',
      },
    },
    required: ['document'],
  },
};

/** The MCP tools as API tool definitions. */
export function apiTools(recipes: boolean): Anthropic.Tool[] {
  const offered = tools.filter(
    (t) =>
      t.name !== 'algoviz_render' && (recipes || !t.name.includes('recipe')),
  );
  return [
    ...offered.map((t): Anthropic.Tool => {
      const schema = z.toJSONSchema(t.input, { io: 'input' }) as Record<
        string,
        unknown
      >;
      delete schema['$schema'];
      return {
        name: t.name,
        description: t.description,
        input_schema: schema as Anthropic.Tool.InputSchema,
      };
    }),
    submitTool,
  ];
}

export function systemPrompt(options: AttemptOptions): string {
  if (options.mode === 'oneshot') {
    const text = guide();
    if (!text.ok) throw new Error('The guide failed to load');
    return `You write algoviz visualization documents. Trace the algorithm on the given input by hand, one step per thing a learner should see, and narrate each step. Reply with the document only, as one \`\`\`json code block.\n\n${text.value}`;
  }
  const recipes = options.recipes
    ? ''
    : '\n\nRecipes are not available here: write the document yourself.';
  return `${INSTRUCTIONS}${recipes}\n\nWhen the document is valid and checked, hand it in with ${SUBMIT}.`;
}

/** The first ```json block of a reply, or the whole reply if it is JSON. */
export function extractJson(text: string): unknown {
  const block = /```(?:json)?\s*\n([\s\S]*?)```/.exec(text);
  const candidate = block?.[1] ?? text;
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    return undefined;
  }
}

export async function attempt(
  task: EvalTask,
  run: string,
  create: CreateMessage,
  options: AttemptOptions,
): Promise<AttemptResult> {
  const { maxTurns = 24, maxTokens = 32_000 } = options;
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: visualizeRequest(task.prompt) },
  ];
  const offered =
    options.mode === 'tools' ? apiTools(options.recipes ?? false) : [];
  const finish = (stop: Stop, turns: number): AttemptResult => ({
    stop,
    turns,
    usage,
    transcript: messages,
  });

  for (let turn = 1; turn <= maxTurns; turn++) {
    const response = await create({
      model: options.model,
      max_tokens: maxTokens,
      system: systemPrompt(options),
      messages,
      // Caches the guide and the conversation so far between turns.
      cache_control: { type: 'ephemeral' },
      ...(offered.length > 0 ? { tools: offered } : {}),
      ...(options.effort ? { output_config: { effort: options.effort } } : {}),
    });
    usage.input += response.usage.input_tokens;
    usage.output += response.usage.output_tokens;
    usage.cacheRead += response.usage.cache_read_input_tokens ?? 0;
    usage.cacheWrite += response.usage.cache_creation_input_tokens ?? 0;
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'refusal') return finish('refusal', turn);
    if (response.stop_reason === 'max_tokens')
      return finish('max_tokens', turn);

    const uses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    if (uses.length === 0) {
      // A reply without tool calls ends the attempt; in one-shot mode it
      // is the answer, otherwise any document in it counts as submitted.
      const text = response.content
        .flatMap((b) => (b.type === 'text' ? [b.text] : []))
        .join('\n');
      const doc = extractJson(text);
      if (doc === undefined) {
        appendLog(run, task.id, { tool: 'answer', ok: false });
        return finish('no_submission', turn);
      }
      submit(run, task.id, doc);
      return finish('answered', turn);
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    let submitted = false;
    for (const use of uses) {
      const input = (use.input ?? {}) as Record<string, unknown>;
      if (use.name === SUBMIT) {
        if (input['document'] === undefined) {
          results.push({
            type: 'tool_result',
            tool_use_id: use.id,
            content: `${SUBMIT} needs a document.`,
            is_error: true,
          });
          continue;
        }
        submit(run, task.id, input['document']);
        submitted = true;
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: 'Submitted.',
        });
        continue;
      }
      const result = loggedCall(run, task.id, use.name, input);
      results.push({
        type: 'tool_result',
        tool_use_id: use.id,
        content: result.text,
        ...(result.isError ? { is_error: true } : {}),
      });
    }
    messages.push({ role: 'user', content: results });
    if (submitted) return finish('submitted', turn);
  }
  return finish('max_turns', maxTurns);
}
