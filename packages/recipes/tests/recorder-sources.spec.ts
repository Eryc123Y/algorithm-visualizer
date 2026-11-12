import { describe, expect, it } from 'vitest';

import { Recorder } from '../src/index.ts';

const sources = [
  {
    language: 'pseudocode',
    code: 'PUSH(s, x)\n    add x on top',
    anchors: { push: 2 },
  },
  {
    language: 'python',
    code: 'def push(s, x):\n    s.append(x)',
    anchors: { push: 2 },
  },
];

describe('Recorder with sources (ADR 0017)', () => {
  it('writes the sources and the anchors steps name, as version 0.3', () => {
    const r = new Recorder({ sources });
    const s = r.add('s', { kind: 'stack', initial: [1] });
    r.step({ at: 'push', narration: 'Push 2.' });
    s.push({ element: 2 });
    const doc = r.build();
    expect(doc.sources).toEqual(sources);
    expect(doc.steps[0]?.meta).toEqual({ at: 'push', narration: 'Push 2.' });
    expect(doc.version).toBe('1.0');
  });

  it('rejects an anchor missing from a source when building', () => {
    const r = new Recorder({ sources });
    r.add('s', { kind: 'stack', initial: [1] });
    r.step({ at: 'pop' });
    expect(() => r.build()).toThrow(/UNKNOWN_ANCHOR/);
  });
});
