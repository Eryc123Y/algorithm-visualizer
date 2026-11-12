/**
 * The response headers of the site (ADR 0040), written once: the build
 * puts the Content Security Policy in each page's `<meta>` and every
 * header in `_headers`, which Cloudflare Pages reads.
 *
 * The share page renders documents anyone can write into a link, so its
 * policy allows only the site's own scripts, styles and fonts, makes no
 * connections, and enforces Trusted Types: no string reaches an HTML
 * sink except through Lit's own template policy, `lit-html`. The player
 * builds its scene with DOM calls and never parses markup. Framing stays
 * allowed, so course pages can embed a share link; the page has no
 * action that a framing page could trick a click into.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  // Only the site's own files: it serves no user content, so 'self'
  // cannot be made to run a script someone else wrote.
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "require-trusted-types-for 'script'",
  'trusted-types lit-html',
].join('; ');

/** Headers for every path, as `_headers` lists them. */
export const SITE_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), focus-without-user-activation=()',
};

/** Hashed build output never changes, so browsers may keep it. */
const ASSET_HEADERS: Readonly<Record<string, string>> = {
  'Cache-Control': 'public, max-age=31536000, immutable',
};

/** The `_headers` file of Cloudflare Pages. */
export function headersFile(): string {
  const block = (path: string, headers: Readonly<Record<string, string>>) =>
    [
      path,
      ...Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`),
    ].join('\n');
  return `${block('/*', SITE_HEADERS)}\n\n${block('/assets/*', ASSET_HEADERS)}\n`;
}
