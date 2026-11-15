/**
 * Figures in a locale (ADR 0045): the layout's own words follow it, and a
 * locale we do not have is an error, as a layout we do not have is.
 */
import { describe, expect, it } from 'vitest';

import { exportFigures, prepareScenes } from '../src/index.ts';

const stack = {
  version: '1.0',
  structures: { s: { kind: 'stack', initial: [] } },
  steps: [{ actions: [{ target: 's', type: 'push', element: 1 }] }],
};

describe('figures in a locale', () => {
  it('draw the layout’s words in English by default and in Chinese if asked', () => {
    const en = exportFigures(stack);
    const zh = exportFigures(stack, { locale: 'zh' });
    if (!en.ok || !zh.ok) throw new Error('export failed');
    // Chinese stays text in an outlined figure (ADR 0024).
    expect(zh.value.figures[0]!.svg).toContain('栈顶（空）');
    expect(zh.value.figures[1]!.svg).toContain('栈顶');
    expect(en.value.figures[0]!.svg).not.toContain('栈顶');
  });

  it('refuse a locale they do not have, saying which they have', () => {
    const result = prepareScenes(stack, { locale: 'fr' as 'en' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error[0]).toMatchObject({
      code: 'UNKNOWN_LOCALE',
      path: '$.locale',
    });
    expect(result.error[0]!.hint).toContain('en, zh');
  });
});
