import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { main } from '../src/cli.ts';
import { formatInspect, inspect, MAX_FRAMES } from '../src/inspect.ts';
import { render } from '../src/render.ts';
import { show } from '../src/show.ts';
import { callTool } from '../src/tools.ts';
import { formatReport, validate } from '../src/validate.ts';

/** Two sections of named steps (ADR 0020). */
const named = {
  version: '0.2',
  title: 'Stack',
  structures: { s: { kind: 'stack', initial: [1] } },
  steps: [
    {
      actions: [{ target: 's', type: 'push', element: 2 }],
      meta: { id: 'push', narration: 'Push 2.' },
    },
    {
      actions: [{ target: 's', type: 'push', element: 3 }],
      meta: { id: 'push', narration: 'Push 3.' },
    },
    {
      actions: [{ target: 's', type: 'pop' }],
      meta: { id: 'pop', narration: 'Pop 3.' },
    },
  ],
  sections: [
    { id: 'push-twice', title: 'Push twice', start: 0 },
    { id: 'pop-once', title: 'Pop once', start: 2 },
  ],
};

const framesOf = (selectors: (number | string)[]) => {
  const report = inspect(named, selectors);
  return report.ok ? report.value.described.map((f) => f.frame) : report.error;
};

describe('inspect with selectors', () => {
  it('takes step names, sections and ranges as well as numbers', () => {
    expect(framesOf(['push#2'])).toEqual([2]);
    expect(framesOf(['pop-once'])).toEqual([2, 3]);
    expect(framesOf(['0..push'])).toEqual([0, 1]);
    expect(framesOf([0, 'pop', -1])).toEqual([0, 3, 3]);
  });

  it('says which step and section each frame shows, and how to select it', () => {
    const report = inspect(named, ['push#2']);
    expect(report.ok && report.value.described[0]).toMatchObject({
      frame: 2,
      step: 'push',
      section: 'push-twice',
      selector: 'push-twice/push#2',
    });
    expect(report.ok && formatInspect(report.value)).toMatch(
      /^Frame 2 of 0–3 · push-twice\/push#2 · section "Push twice"\nnarration: Push 3\./,
    );
  });

  it('lists the names it has when a selector matches nothing', () => {
    const errors = framesOf(['relax']);
    expect(errors).toMatchObject([{ code: 'NO_MATCH' }]);
    expect((errors as unknown as { hint: string }[])[0]!.hint).toContain(
      'Sections: push-twice, pop-once. Step names: push, pop.',
    );
  });

  it('describes at most MAX_FRAMES frames, ranges included', () => {
    const long = {
      ...named,
      steps: Array.from({ length: 30 }, () => ({
        actions: [],
        meta: { id: 'wait', narration: 'Wait.' },
      })),
      sections: [{ id: 'all', title: 'All', start: 0 }],
    };
    const report = inspect(long, ['all']);
    expect(report).toMatchObject({
      ok: false,
      error: [{ code: 'LIMIT_EXCEEDED' }],
    });
    if (!report.ok) expect(report.error[0]!.message).toContain('31 frames');
    expect(inspect(long, ['wait#3..wait#22']).ok).toBe(true);
    expect(MAX_FRAMES).toBe(20);
  });
});

describe('render and show with selectors', () => {
  it('render one frame named by a selector', () => {
    const result = render(named, { frame: 'pop' });
    expect(result.ok && result.value.frame).toBe(3);
    expect(render(named, { frame: 'push-twice/push#2' })).toMatchObject({
      ok: true,
      value: { frame: 2 },
    });
  });

  it('refuse a section, which is several frames', () => {
    const result = render(named, { frame: 'push-twice' });
    expect(result).toMatchObject({
      ok: false,
      error: [{ code: 'INVALID_SELECTOR' }],
    });
  });

  it('show opens on a selected frame', () => {
    const result = show(named, 'push#2');
    expect(result.ok && result.content.frame).toBe(2);
    expect(show(named, 'nope').ok).toBe(false);
  });
});

describe('validate', () => {
  it('lists the sections of a valid document', () => {
    expect(formatReport(validate(named))).toBe(
      'Valid: s (stack); 3 steps, frames 0–3; sections push-twice, pop-once.',
    );
  });

  it('warns about a section that hides a step name', () => {
    const report = validate({
      ...named,
      sections: [{ id: 'pop', title: 'Pop', start: 2 }],
    });
    expect(report.valid && report.warnings).toMatchObject([
      { code: 'SECTION_HIDES_STEP', path: '$.sections[0].id' },
    ]);
  });
});

describe('tools and CLI with selectors', () => {
  it('accept selectors as tool arguments', () => {
    const inspected = callTool('algoviz_inspect', {
      document: named,
      frames: ['push#2', 0],
    });
    expect(inspected.isError).toBeUndefined();
    expect(inspected.text).toContain('Frame 2 of 0–3');
    const rendered = callTool('algoviz_render', {
      document: named,
      frame: 'pop-once/pop',
    });
    expect(rendered.text).toMatch(/^<svg/);
  });

  it('accept selectors on the command line', () => {
    const dir = mkdtempSync(join(tmpdir(), 'algoviz-selectors-'));
    const file = join(dir, 'doc.json');
    writeFileSync(file, JSON.stringify(named));
    const out: string[] = [];
    const run = (...argv: string[]) =>
      main(
        argv,
        (t) => out.push(t),
        () => undefined,
      );
    expect(run('inspect', file, 'push#2', '-1')).toBe(0);
    expect(out.at(-1)).toContain('Frame 2 of 0–3');
    expect(out.at(-1)).toContain('Frame 3 of 0–3');
    expect(run('render', file, '--frame', 'pop')).toBe(0);
    expect(out.at(-1)).toMatch(/^<svg/);
    expect(run('inspect', file, 'relax')).toBe(1);
  });
});
