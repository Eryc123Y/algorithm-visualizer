import { describe, expect, it } from 'vitest';

import { formatErrors, formatPath, type ProtocolError } from '../src/index.ts';

describe('formatPath', () => {
  it('uses dot notation for identifiers and brackets otherwise', () => {
    expect(formatPath([])).toBe('$');
    expect(formatPath(['steps', 3, 'actions', 0, 'j'])).toBe(
      '$.steps[3].actions[0].j',
    );
    expect(formatPath(['structures', 'my-arr'])).toBe('$.structures["my-arr"]');
  });
});

describe('formatErrors', () => {
  const error: ProtocolError = {
    code: 'UNKNOWN_TARGET',
    path: '$.steps[0].actions[0].target',
    message: 'No structure named "ar"',
    hint: 'Declared structures: arr.',
  };

  it('renders one line per error with its hint', () => {
    expect(formatErrors([error])).toBe(
      'UNKNOWN_TARGET at $.steps[0].actions[0].target: No structure named "ar" (hint: Declared structures: arr.)',
    );
  });

  it('truncates long lists', () => {
    const text = formatErrors(
      Array.from({ length: 5 }, () => error),
      { max: 2 },
    );
    expect(text.split('\n')).toHaveLength(3);
    expect(text).toMatch(/…and 3 more$/);
  });
});
