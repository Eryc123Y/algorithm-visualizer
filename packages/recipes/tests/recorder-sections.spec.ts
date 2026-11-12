import { parseVisualization } from '@algomotion/spec';
import { describe, expect, it } from 'vitest';

import { Recorder } from '../src/index.ts';

function stack() {
  const r = new Recorder();
  const s = r.add('s', { kind: 'stack', initial: [1] });
  return { r, s };
}

describe('Recorder step names', () => {
  it('records an id given to step, and writes version 0.2', () => {
    const { r, s } = stack();
    r.step({ id: 'push', narration: 'Push 2.' });
    s.push({ element: 2 });
    const doc = r.build();
    expect(doc.steps[0]?.meta).toEqual({ id: 'push', narration: 'Push 2.' });
    expect(doc.version).toBe('1.0');
  });

  it('rejects an id that is not a step name when building', () => {
    const { r } = stack();
    r.step({ id: 'Push' });
    expect(() => r.build()).toThrow(RangeError);
  });
});

describe('Recorder sections', () => {
  it('starts a section at the next step', () => {
    const { r, s } = stack();
    r.step('Before any section.');
    r.section('push-twice', 'Push twice');
    r.step({ id: 'push' });
    s.push({ element: 2 });
    r.step({ id: 'push' });
    s.push({ element: 3 });
    r.section('pop', 'Pop');
    r.step({ id: 'pop' });
    s.pop();
    const doc = r.build();
    expect(doc.sections).toEqual([
      { id: 'push-twice', title: 'Push twice', start: 1 },
      { id: 'pop', title: 'Pop', start: 3 },
    ]);
    expect(doc.version).toBe('1.0');
    expect(parseVisualization(doc).ok).toBe(true);
  });

  it('puts actions recorded right after a section in a new step of it', () => {
    const { r, s } = stack();
    r.step();
    s.push({ element: 2 });
    r.section('pop', 'Pop');
    s.pop();
    const doc = r.build();
    expect(doc.steps).toHaveLength(2);
    expect(doc.steps[1]?.actions).toEqual([{ target: 's', type: 'pop' }]);
    expect(doc.sections).toEqual([{ id: 'pop', title: 'Pop', start: 1 }]);
  });

  it('leaves sections out of documents that have none', () => {
    const { r, s } = stack();
    s.pop();
    const doc = r.build();
    expect(doc).not.toHaveProperty('sections');
    expect(doc.version).toBe('1.0');
  });

  it('refuses an id used twice, or one that is not a section id', () => {
    const { r } = stack();
    r.section('pop', 'Pop');
    r.step();
    expect(() => r.section('pop', 'Again')).toThrow(
      'Section "pop" is already used',
    );
    expect(() => r.section('Pop 2', 'Pop 2')).toThrow(
      '"Pop 2" is not a section id',
    );
    expect(() => r.section('pop-2', '')).toThrow(
      'Section "pop-2" needs a title of 1 to 2000 characters',
    );
  });

  it('refuses a section without steps', () => {
    const { r } = stack();
    r.section('empty', 'Empty');
    expect(() => r.section('next', 'Next')).toThrow(
      'Section "empty" has no steps',
    );
    expect(() => r.build()).toThrow('Section "empty" has no steps');
  });
});
