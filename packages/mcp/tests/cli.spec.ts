import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { main } from '../src/cli.ts';

const dir = mkdtempSync(join(tmpdir(), 'algoviz-cli-'));
const file = join(dir, 'doc.json');
writeFileSync(
  file,
  JSON.stringify({
    version: '0.1',
    structures: { q: { kind: 'queue', initial: [1, 2] } },
    steps: [
      {
        actions: [{ target: 'q', type: 'dequeue' }],
        meta: { narration: 'Take 1.' },
      },
    ],
  }),
);

function run(...argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = main(
    argv,
    (t) => out.push(t),
    (t) => err.push(t),
  );
  return { code, out: out.join('\n'), err: err.join('\n') };
}

describe('algoviz CLI', () => {
  it('validates a file', () => {
    expect(run('validate', file)).toEqual({
      code: 0,
      out: 'Valid: q (queue); 1 steps, frames 0–1.',
      err: '',
    });
  });

  it('inspects frames, counting negative ones from the end', () => {
    const { code, out } = run('inspect', file, '0', '-1');
    expect(code).toBe(0);
    expect(out).toContain('Frame 0 of 0–1');
    expect(out).toContain('Frame 1 of 0–1');
  });

  it('renders a frame to a file', () => {
    const svg = join(dir, 'frame.svg');
    expect(run('render', file, '--frame=0', '--out', svg).code).toBe(0);
    expect(readFileSync(svg, 'utf8')).toMatch(/^<svg/);
  });

  it('runs a registry module by id', () => {
    const { code, out } = run(
      'run',
      'bst.delete',
      '{"from": [8, 3, 10, 1, 6], "key": 3}',
    );
    expect(code).toBe(0);
    expect(JSON.parse(out)).toMatchObject({
      version: '0.3',
      title: 'Binary search tree: delete 3',
    });
  });

  it('runs a legacy recipe, also by its old command', () => {
    for (const command of ['run', 'recipe']) {
      const { code, out } = run(
        command,
        'binarySearch',
        '{"values":[1,2],"target":2}',
      );
      expect(code).toBe(0);
      expect(JSON.parse(out)).toHaveProperty('version', '0.1');
    }
  });

  it('lists the recipes', () => {
    const listed = JSON.parse(run('recipes').out) as { id: string }[];
    expect(listed.map((r) => r.id)).toContain('min-heap.decrease-key');
  });

  it('reports a bad input with its path', () => {
    const { code, err } = run('run', 'bst.search', '{"from": [1], "key": "x"}');
    expect(code).toBe(1);
    expect(err).toContain('INVALID_SHAPE at $.input.key');
  });

  it('exits with 1 on an invalid document', () => {
    writeFileSync(join(dir, 'bad.json'), '{}');
    const { code, err } = run('validate', join(dir, 'bad.json'));
    expect(code).toBe(1);
    expect(err).toContain('INVALID_SHAPE');
  });

  it('exits with 2 on a usage error', () => {
    expect(run('validate').code).toBe(2);
    expect(run('frobnicate').code).toBe(2);
    expect(run('render', file, '--zoom', '2').code).toBe(2);
    expect(run('run', 'bst', '{oops').code).toBe(2);
    expect(run('run').code).toBe(2);
    expect(run('run', 'bst').code).toBe(2);
  });

  it('prints usage without a command', () => {
    expect(run().out).toMatch(/^Usage:/);
  });
});
