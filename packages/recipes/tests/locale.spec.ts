/**
 * Runs in each locale (ADR 0045): a recipe writes its run in the locale it
 * is asked for, and only what a reader sees changes.
 */
import { LOCALES } from '@algomotion/spec';
import { describe, expect, it } from 'vitest';

import {
  algorithms,
  findAlgorithm,
  runAlgorithm,
  summaryOf,
  textIn,
  titleOf,
  topicTitle,
  TOPIC_TITLES,
  TOPICS,
  type Text,
} from '../src/index.ts';
import { recordingTrace, silentTrace } from '../src/trace.ts';
import { Recorder } from '../src/recorder.ts';

const CJK = /[\u{4e00}-\u{9fff}]/u;

/** The document of a run, which must succeed. */
function documentOf(id: string, locale: 'en' | 'zh', input?: unknown) {
  const run = runAlgorithm(id, input, { locale });
  if (!run.ok) throw new Error(JSON.stringify(run.error));
  return run.value.document as {
    title?: string;
    steps: { meta?: { id?: string; narration?: string; at?: string } }[];
    sections?: { id: string; title: string }[];
  };
}

describe('Text', () => {
  it('is the same in every locale when it is a plain string', () => {
    for (const locale of LOCALES) expect(textIn('d[v]', locale)).toBe('d[v]');
  });

  it('picks the locale’s string from an object', () => {
    const text: Text = { en: 'sorted', zh: '已排序' };
    expect(textIn(text, 'en')).toBe('sorted');
    expect(textIn(text, 'zh')).toBe('已排序');
  });
});

describe('a trace’s locale', () => {
  it('records a step’s narration and a section’s title in its locale', () => {
    const recorder = new Recorder({
      title: 'T',
      sources: [{ language: 'pseudocode', code: 'DONE', anchors: {} }],
    });
    const trace = recordingTrace(recorder, new Set(), 'zh');
    expect(trace.locale).toBe('zh');
    expect(trace.say({ en: 'Calls', zh: '调用' })).toBe('调用');
    trace.add('a', { kind: 'array', initial: [1] });
    trace.section('one', { en: 'One', zh: '一' });
    trace.step(null, { en: 'Done.', zh: '完成。' }, { id: 'done' });
    const doc = recorder.build() as {
      steps: { meta?: { narration?: string } }[];
      sections?: { title: string }[];
    };
    expect(doc.steps.at(-1)!.meta!.narration).toBe('完成。');
    expect(doc.sections?.[0]?.title).toBe('一');
  });

  it('is English unless said otherwise, for silent traces too', () => {
    const recorder = new Recorder({ title: 'T', sources: [] });
    expect(recordingTrace(recorder, new Set()).locale).toBe('en');
    expect(silentTrace().say({ en: 'a', zh: '甲' })).toBe('a');
    expect(silentTrace('zh').say({ en: 'a', zh: '甲' })).toBe('甲');
  });

  it('refuses an empty narration in any locale', () => {
    const recorder = new Recorder({ title: 'T', sources: [] });
    const trace = recordingTrace(recorder, new Set(), 'zh');
    expect(() =>
      trace.step(null, { en: 'Done.', zh: ' ' }, { id: 'x' }),
    ).toThrow(/narration/);
  });
});

describe('runs in Chinese', () => {
  it('narrate Dijkstra’s algorithm in Chinese, and in English by default', () => {
    const en = documentOf('dijkstra', 'en');
    const zh = documentOf('dijkstra', 'zh');
    expect(runAlgorithm('dijkstra')).toEqual(
      runAlgorithm('dijkstra', undefined, { locale: 'en' }),
    );
    expect(en.steps[1]!.meta!.narration).not.toMatch(CJK);
    for (const step of zh.steps.slice(1))
      expect(step.meta!.narration).toMatch(CJK);
    expect(zh.title).toMatch(CJK);
  });

  it('keep step names, anchors and the steps themselves', () => {
    for (const id of ['dijkstra', 'bst', 'insertion-sort']) {
      const en = documentOf(id, 'en');
      const zh = documentOf(id, 'zh');
      expect(zh.steps.length).toBe(en.steps.length);
      zh.steps.forEach((step, k) => {
        expect(step.meta?.id).toBe(en.steps[k]!.meta?.id);
        expect(step.meta?.at).toBe(en.steps[k]!.meta?.at);
      });
      // Section ids are selectors: the same in every language.
      expect(zh.sections?.map((s) => s.id)).toEqual(
        en.sections?.map((s) => s.id),
      );
    }
  });
});

describe('names in each locale', () => {
  it('give every module and topic a title and summary in every locale', () => {
    for (const a of algorithms)
      for (const locale of LOCALES) {
        expect(titleOf(a, locale)).not.toBe('');
        expect(summaryOf(a, locale)).not.toBe('');
      }
    for (const topic of TOPICS) {
      expect(topicTitle(topic, 'en')).toBe(TOPIC_TITLES[topic]);
      expect(topicTitle(topic, 'zh')).toMatch(CJK);
    }
  });

  it('name Dijkstra’s algorithm in Chinese, and keep the English names', () => {
    const dijkstra = findAlgorithm('dijkstra')!;
    expect(dijkstra.title).toBe('Dijkstra’s algorithm');
    expect(titleOf(dijkstra, 'en')).toBe('Dijkstra’s algorithm');
    expect(titleOf(dijkstra, 'zh')).toBe('Dijkstra 算法');
    expect(summaryOf(dijkstra, 'zh')).toMatch(CJK);
  });
});
