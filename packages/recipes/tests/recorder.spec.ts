import * as spec from '@algoviz/spec';
import { describe, expect, it, vi } from 'vitest';

import { Recorder } from '../src/index.ts';

// Watch the version helper without changing what it returns.
vi.mock('@algoviz/spec', async (importOriginal) => {
  const actual = await importOriginal<typeof spec>();
  return { ...actual, minimumVersion: vi.fn(actual.minimumVersion) };
});

describe('Recorder versions', () => {
  it('writes the oldest version that holds every feature the document uses', () => {
    vi.mocked(spec.minimumVersion).mockClear();
    const r = new Recorder({ title: 'Swap' });
    const a = r.add('a', { kind: 'array', initial: [2, 1] });
    r.step('Swap the two values.');
    a.swap({ i: 0, j: 1 });
    const doc = r.build();

    const { version, ...content } = doc;
    expect(spec.minimumVersion).toHaveBeenCalledWith(content);
    expect(version).toBe(spec.minimumVersion(content));
  });

  it('writes 0.1 for a document that uses no later feature', () => {
    const r = new Recorder({ title: 'Look' });
    const a = r.add('a', { kind: 'array', initial: [1, 2, 3] });
    r.step('Look at the middle value.');
    a.highlight({ indices: [1] });
    expect(r.build().version).toBe('0.1');
  });
});
