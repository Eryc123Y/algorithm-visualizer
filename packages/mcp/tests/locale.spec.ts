/**
 * The tools and the CLI in a locale (ADR 0045): a recipe's run and the
 * figure's own words follow `locale` (`--lang` on the command line);
 * English stays the default, and diagnostics stay English.
 */
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { main } from '../src/cli.ts';
import { sourceShare } from '../src/share.ts';
import { showSource } from '../src/show.ts';
import { callTool } from '../src/tools.ts';

const CJK = /[\u{4e00}-\u{9fff}]/u;

function cli(...argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = main(
    argv,
    (t) => out.push(t),
    (t) => err.push(t),
  );
  return { code, out: out.join('\n'), err: err.join('\n') };
}

const narrations = (json: string) =>
  (
    JSON.parse(json) as { steps: { meta?: { narration?: string } }[] }
  ).steps.map((s) => s.meta?.narration ?? '');

describe('the tools in a locale', () => {
  it('run a recipe in Chinese, and in English by default', () => {
    const zh = callTool('algomotion_run_recipe', {
      id: 'dijkstra',
      input: 'A-B 4, B-C 1',
      locale: 'zh',
    });
    expect(zh.isError).toBeFalsy();
    expect(narrations(zh.text)[0]).toMatch(CJK);
    // A link to the run carries its language.
    expect(zh.share).toMatchObject({ algorithm: 'dijkstra', lang: 'zh' });
    const en = callTool('algomotion_run_recipe', {
      id: 'dijkstra',
      input: 'A-B 4, B-C 1',
    });
    expect(narrations(en.text)[0]).not.toMatch(CJK);
    expect(en.share).not.toHaveProperty('lang');
  });

  it('draw the figure’s own words in the locale', () => {
    const svg = callTool('algomotion_render', {
      recipe: 'dijkstra',
      input: 'A-B 4, B-C 1',
      frame: 0,
      locale: 'zh',
    });
    expect(svg.isError).toBeFalsy();
    // The queue is empty before the first step.
    expect(svg.text).toContain('（空）');
  });

  it('inspect a recipe’s run in the locale', () => {
    const text = callTool('algomotion_inspect', {
      recipe: 'dijkstra',
      input: 'A-B 4, B-C 1',
      frames: [1],
      locale: 'zh',
    }).text;
    expect(text).toMatch(CJK);
  });

  it('show a recipe in the locale, and tell the player its language', () => {
    const shown = showSource({
      recipe: 'dijkstra',
      input: 'A-B 4, B-C 1',
      locale: 'zh',
    });
    expect(shown.ok).toBe(true);
    if (!shown.ok) return;
    expect(shown.content.locale).toBe('zh');
  });

  it('refuse a locale they do not have, in English', () => {
    const result = callTool('algomotion_run_recipe', {
      id: 'dijkstra',
      locale: 'fr',
    });
    expect(result.isError).toBe(true);
    expect(result.text).toContain('locale');
  });
});

describe('share links in a locale', () => {
  it('carry the language asked for, for a document as for a recipe', () => {
    const document = {
      version: '1.0',
      structures: { s: { kind: 'stack', initial: [] } },
      steps: [],
    };
    expect(sourceShare({ document, locale: 'zh' })).toMatchObject({
      lang: 'zh',
    });
    expect(sourceShare({ recipe: 'dijkstra', locale: 'zh' })).toMatchObject({
      lang: 'zh',
    });
    expect(sourceShare({ document })).not.toHaveProperty('lang');
  });
});

describe('the CLI in a locale', () => {
  it('runs an algorithm in Chinese with --lang zh', () => {
    const { code, out } = cli(
      'run',
      'dijkstra',
      'A-B 4, B-C 1',
      '--lang',
      'zh',
    );
    expect(code).toBe(0);
    expect(narrations(out)[0]).toMatch(CJK);
  });

  it('exports figures whose own words and descriptions are Chinese', () => {
    const dir = mkdtempSync(join(tmpdir(), 'algomotion-lang-'));
    const { code } = cli(
      'export',
      'dijkstra',
      '--input',
      'A-B 4, B-C 1',
      '--step',
      '1',
      '--lang=zh',
      '--out',
      dir,
    );
    expect(code).toBe(0);
    const [svg] = readdirSync(dir);
    const text = readFileSync(join(dir, svg!), 'utf8');
    expect(text).toContain('最小');
    expect(text).toMatch(/<desc>[^<]*[\u{4e00}-\u{9fff}]/u);
  });

  it('refuses a language it does not have, saying which it has', () => {
    const { code, err } = cli('run', 'dijkstra', '--lang', 'fr');
    expect(code).not.toBe(0);
    expect(err).toContain('en, zh');
  });
});
