import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { logPath, readLog } from '../src/log.ts';

describe('readLog', () => {
  it('reads the tools of runs recorded before the rename by their new names', () => {
    const run = mkdtempSync(join(tmpdir(), 'algomotion-log-'));
    writeFileSync(
      logPath(run, 't'),
      [
        { tool: 'algoviz_guide', ok: true },
        { tool: 'algoviz_validate', ok: false, codes: ['UNKNOWN_FIELD'] },
        { tool: 'algomotion_inspect', ok: true },
        { tool: 'submit', ok: true },
      ]
        .map((e) => JSON.stringify(e))
        .join('\n'),
    );
    expect(readLog(run, 't')).toEqual([
      { tool: 'algomotion_guide', ok: true },
      { tool: 'algomotion_validate', ok: false, codes: ['UNKNOWN_FIELD'] },
      { tool: 'algomotion_inspect', ok: true },
      { tool: 'submit', ok: true },
    ]);
  });
});
