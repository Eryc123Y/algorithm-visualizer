/**
 * The site's headers (ADR 0040, 0041): the policy that the share page
 * enforces, in `_headers` for Cloudflare Pages and in each page's <meta>.
 */
import { describe, expect, it } from 'vitest';

import {
  CONTENT_SECURITY_POLICY,
  headersFile,
  SITE_HEADERS,
  withPolicy,
} from '../../src/headers.ts';

const directives = new Map(
  CONTENT_SECURITY_POLICY.split('; ').map((d) => {
    const [name, ...values] = d.split(' ');
    return [name!, values.join(' ')];
  }),
);

describe('the site’s headers', () => {
  it('allow only the site’s own files, and enforce Trusted Types', () => {
    expect(directives.get('default-src')).toBe("'none'");
    expect(directives.get('script-src')).toBe("'self'");
    expect(directives.get('connect-src')).toBe("'none'");
    expect(directives.get('object-src')).toBe("'none'");
    expect(directives.get('base-uri')).toBe("'none'");
    expect(directives.get('require-trusted-types-for')).toBe("'script'");
    expect(directives.get('trusted-types')).toBe('lit-html');
    for (const [, value] of directives) {
      expect(value).not.toMatch(/unsafe|data:|\*/);
    }
    // Framing stays allowed, so course pages can embed a link (ADR 0040).
    expect(directives.has('frame-ancestors')).toBe(false);
  });

  it('write _headers for every path, and caching for hashed assets', () => {
    const file = headersFile();
    expect(file.startsWith('/*\n')).toBe(true);
    for (const [name, value] of Object.entries(SITE_HEADERS))
      expect(file).toContain(`  ${name}: ${value}\n`);
    expect(file).toContain(
      '/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n',
    );
  });

  it('put the policy right after the charset', () => {
    const html =
      '<!doctype html><html><head>\n    <meta charset="utf-8" />\n    <script type="module" src="x.js"></script></head></html>';
    const out = withPolicy(html, 'play/index.html');
    const charset = out.indexOf('<meta charset');
    const policy = out.indexOf('http-equiv="Content-Security-Policy"');
    expect(charset).toBeGreaterThan(-1);
    expect(policy).toBeGreaterThan(charset);
    expect(policy).toBeLessThan(out.indexOf('<script'));
  });

  it('refuse a page without the charset first', () => {
    expect(() => withPolicy('<head></head>', 'x.html')).toThrow(/charset/);
  });
});
