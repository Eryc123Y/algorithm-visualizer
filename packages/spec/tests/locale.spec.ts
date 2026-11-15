import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { LOCALES, isLocale, localeOf } from '../src/index.ts';

describe('locales (ADR 0045)', () => {
  it('are English and Simplified Chinese, English first', () => {
    expect(LOCALES).toEqual(['en', 'zh']);
    expect(isLocale('zh')).toBe(true);
    expect(isLocale('fr')).toBe(false);
  });

  it('read any Chinese tag as Chinese, whatever its script or region', () => {
    for (const tag of [
      'zh',
      'zh-Hans',
      'zh-CN',
      'zh-SG',
      'zh-Hant',
      'zh-TW',
      'ZH-hk',
      'zh_CN',
    ])
      expect(localeOf(tag)).toBe('zh');
  });

  it('read every other tag, and none, as English', () => {
    for (const tag of ['en', 'en-GB', 'fr', 'ja', 'zha', '', undefined, null])
      expect(localeOf(tag)).toBe('en');
    fc.assert(
      fc.property(fc.string(), (tag) => {
        expect(LOCALES).toContain(localeOf(tag));
      }),
    );
  });

  it('take the first of several tags that names a language it has', () => {
    expect(localeOf(['fr', 'zh-CN', 'en'])).toBe('zh');
    expect(localeOf(['en-US', 'zh'])).toBe('en');
    expect(localeOf([])).toBe('en');
  });
});
