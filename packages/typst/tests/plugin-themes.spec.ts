/** The theme files between them draw every theme, each once. */
import { describe, expect, it } from 'vitest';

import { themes } from '@algomotion/svg';

import { PARTS, themesOfPart } from './plugin-themes.ts';

describe('the theme files', () => {
  it('share out every theme, each once', () => {
    const shared = Array.from({ length: PARTS }, (_, k) =>
      themesOfPart(k),
    ).flat();
    expect(shared.toSorted()).toEqual(Object.keys(themes).toSorted());
  });
});
