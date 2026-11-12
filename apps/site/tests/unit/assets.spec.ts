/**
 * The files a documentation page loads, from Vite's manifest.
 */
import { describe, expect, it } from 'vitest';

import { assetsOf } from '../../src/docs/assets.ts';

describe('assetsOf', () => {
  it('takes the script, every style once, and the modules it imports', () => {
    expect(
      assetsOf(
        {
          'src/docs/main.ts': {
            file: 'assets/docs.js',
            css: ['assets/docs.css'],
            imports: ['_shared', '_fonts'],
          },
          _shared: {
            file: 'assets/shared.js',
            css: ['assets/fonts.css'],
            imports: ['_fonts'],
          },
          _fonts: { file: 'assets/fonts.js', css: ['assets/fonts.css'] },
          'play/index.html': { file: 'assets/play.js' },
        },
        'src/docs/main.ts',
      ),
    ).toEqual({
      scripts: ['assets/docs.js'],
      styles: ['assets/docs.css', 'assets/fonts.css'],
      preloads: ['assets/shared.js', 'assets/fonts.js'],
    });
  });

  it('says when Vite built no such entry', () => {
    expect(() => assetsOf({}, 'src/docs/main.ts')).toThrow(/vite build/);
  });
});
