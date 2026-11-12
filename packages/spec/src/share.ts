/**
 * Share links (ADR 0040): a document, or an algorithm and its input, in
 * the fragment of a player page's URL, after a version marker:
 *
 *     #v=1&doc=<the document's JSON, raw DEFLATE, base64url>
 *     #v=1&alg=dijkstra&in=A-B%204&frame=improve%233&theme=dark
 *
 * Compression uses the platform's `CompressionStream`, which browsers,
 * Node.js and Workers have. The protocol stays free of DOM and Node.js
 * types (ADR 0005), so the few web APIs used here are looked up on
 * `globalThis` and typed locally; a runtime without them, such as the
 * Typst plugin's, can still write and read algorithm links.
 */
import type { Diagnostic } from './errors.ts';
import { err, ok, type Result } from './result.ts';

/** The version of the link format that this code writes and reads. */
export const SHARE_LINK_VERSION = 1;

export const SHARE_LIMITS = {
  /** The longest link a writer makes. */
  linkLength: 16_384,
  /** The longest fragment a reader takes: Chrome's longest URL. */
  fragmentLength: 2_097_152,
  /** The most bytes a document may inflate to. */
  documentBytes: 16 * 1024 * 1024,
  /** The longest `alg`, `frame` or `theme`. */
  textLength: 200,
} as const;

export type ShareErrorCode =
  /** The fragment, or a base URL, is not a share link's. */
  | 'INVALID_LINK'
  /** The link, or the document it holds, is over a limit. */
  | 'LINK_TOO_LARGE';

export type ShareDiagnostic = Diagnostic<ShareErrorCode>;

/** How the player opens the content: as its `frame` and `theme`. */
interface ShareView {
  /** A frame number or a selector (ADR 0020); a reader gives it as text. */
  readonly frame?: string | number;
  /** A theme as the player's `theme` attribute takes it. */
  readonly theme?: string;
}

/** What a share link carries: a document, or an algorithm and its input. */
export type ShareContent =
  | (ShareView & { readonly document: unknown })
  | (ShareView & {
      /** A registry id, such as `dijkstra`. */
      readonly algorithm: string;
      /** The input as text, read by `readInput` (ADR 0032). */
      readonly input?: string;
    });

type Shared<T> = Promise<Result<T, readonly ShareDiagnostic[]>>;

// --- Writing ------------------------------------------------------------------

/** The fragment of a link, without its `#`. */
export async function shareFragment(content: ShareContent): Shared<string> {
  const pairs: [string, string][] = [['v', String(SHARE_LINK_VERSION)]];
  if ('document' in content) {
    const json = JSON.stringify(content.document) as string | undefined;
    if (json === undefined)
      return fail('INVALID_LINK', '$.doc', 'The document is not JSON');
    const packed = await deflate(json);
    if (!packed.ok) return packed;
    pairs.push(['doc', packed.value]);
  } else {
    pairs.push(['alg', content.algorithm]);
    if (content.input !== undefined) pairs.push(['in', content.input]);
  }
  if (content.frame !== undefined && String(content.frame) !== '0')
    pairs.push(['frame', String(content.frame)]);
  if (content.theme !== undefined) pairs.push(['theme', content.theme]);

  const parts: string[] = [];
  for (const [key, value] of pairs) {
    try {
      parts.push(`${key}=${key === 'doc' ? value : encodeURIComponent(value)}`);
    } catch {
      return fail(
        'INVALID_LINK',
        `$.${key}`,
        `\`${key}\` holds a lone surrogate, which has no UTF-8 form`,
      );
    }
  }
  return ok(parts.join('&'));
}

/** A whole link: the page's address, then the fragment. */
export async function shareLink(
  base: string,
  content: ShareContent,
): Shared<string> {
  const page = checkShareBase(base);
  if (!page.ok) return page;
  const fragment = await shareFragment(content);
  if (!fragment.ok) return fragment;
  const link = `${page.value}#${fragment.value}`;
  if (link.length > SHARE_LIMITS.linkLength)
    return fail(
      'LINK_TOO_LARGE',
      '$',
      `The link would be ${thousands(link.length)} characters long, over the limit of ${thousands(SHARE_LIMITS.linkLength)} for share links`,
      'Share the document as a file instead, or a recipe and its input, whose link carries only the input.',
    );
  return ok(link);
}

/**
 * Checks the address of a share page: an absolute `http:` or `https:`
 * URL without a fragment, such as `https://example.org/play/`.
 */
export function checkShareBase(
  base: string,
): Result<string, readonly ShareDiagnostic[]> {
  const hint =
    'Give the address of the share page, such as https://example.org/play/.';
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(base)?.[1];
  if (scheme !== undefined && !/^https?$/i.test(scheme))
    return fail(
      'INVALID_LINK',
      '$',
      `The share page's address must be an http: or https: URL, not ${scheme}:`,
      hint,
    );
  if (!/^https?:\/\/[^/?#\s]+/i.test(base))
    return fail(
      'INVALID_LINK',
      '$',
      `The share page's address must be an absolute URL, not ${quote(base)}`,
      hint,
    );
  if (/\s/.test(base))
    return fail(
      'INVALID_LINK',
      '$',
      "The share page's address must not contain spaces",
      hint,
    );
  if (base.includes('#'))
    return fail(
      'INVALID_LINK',
      '$',
      "The share page's address must not have a fragment: the link's content goes there",
      hint,
    );
  return ok(base);
}

// --- Reading ------------------------------------------------------------------

const CONTENT_KEYS = ['v', 'doc', 'alg', 'in', 'frame', 'theme'] as const;
type Key = (typeof CONTENT_KEYS)[number];

/**
 * Reads a fragment, with or without its `#`: the content it carries, or
 * undefined for an empty fragment. Keys it does not know are ignored.
 */
export async function readShareFragment(
  fragment: string,
): Shared<ShareContent | undefined> {
  const text = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  if (text === '') return ok(undefined);
  if (text.length > SHARE_LIMITS.fragmentLength)
    return fail(
      'LINK_TOO_LARGE',
      '$',
      `The link is ${thousands(text.length)} characters long; a share page reads links of up to ${thousands(SHARE_LIMITS.fragmentLength)}`,
    );

  const pairs = readPairs(text);
  if (!pairs.ok) return pairs;
  const get = (key: Key) => pairs.value.get(key);

  const version = checkVersion(get('v'));
  if (!version.ok) return version;
  for (const key of ['alg', 'frame', 'theme'] as const) {
    const value = get(key);
    if (value !== undefined && value.length > SHARE_LIMITS.textLength)
      return fail(
        'INVALID_LINK',
        `$.${key}`,
        `\`${key}\` is longer than ${SHARE_LIMITS.textLength} characters`,
      );
  }

  const [doc, algorithm, input] = [get('doc'), get('alg'), get('in')];
  const view = {
    ...(get('frame') === undefined ? {} : { frame: get('frame')! }),
    ...(get('theme') === undefined ? {} : { theme: get('theme')! }),
  };
  if (doc !== undefined && algorithm !== undefined)
    return fail(
      'INVALID_LINK',
      '$',
      'The link names both a document (`doc`) and an algorithm (`alg`); a link carries one of them',
    );
  if (doc !== undefined) {
    if (input !== undefined)
      return fail(
        'INVALID_LINK',
        '$.in',
        '`in` is an algorithm’s input, but the link carries a document, not an algorithm (`alg`)',
      );
    const document = await inflate(doc);
    return document.ok ? ok({ document: document.value, ...view }) : document;
  }
  if (algorithm === undefined)
    return fail(
      'INVALID_LINK',
      '$',
      'The link names neither a document (`doc`) nor an algorithm (`alg`)',
      'A share link carries #v=1&doc=… or #v=1&alg=…&in=….',
    );
  if (algorithm === '')
    return fail('INVALID_LINK', '$.alg', '`alg` is empty: name an algorithm');
  return ok({
    algorithm,
    ...(input === undefined ? {} : { input }),
    ...view,
  });
}

/** The fragment's keys and values, decoded; unknown keys are dropped. */
function readPairs(
  text: string,
): Result<Map<Key, string>, readonly ShareDiagnostic[]> {
  const pairs = new Map<Key, string>();
  for (const pair of text.split('&')) {
    if (pair === '') continue;
    const at = pair.indexOf('=');
    if (at < 0)
      return fail(
        'INVALID_LINK',
        '$',
        `Expected key=value in the link, not ${quote(pair)}`,
      );
    let key: string;
    let value: string;
    try {
      key = decodeURIComponent(pair.slice(0, at));
      value = decodeURIComponent(pair.slice(at + 1));
    } catch {
      return fail(
        'INVALID_LINK',
        `$.${pair.slice(0, Math.min(at, 20))}`,
        `${quote(pair.slice(0, 60))} has malformed percent-encoding`,
      );
    }
    if (!isKey(key)) continue;
    if (pairs.has(key))
      return fail(
        'INVALID_LINK',
        `$.${key}`,
        `\`${key}\` is given twice in the link`,
      );
    pairs.set(key, value);
  }
  return ok(pairs);
}

const isKey = (key: string): key is Key =>
  (CONTENT_KEYS as readonly string[]).includes(key);

function checkVersion(
  v: string | undefined,
): Result<void, readonly ShareDiagnostic[]> {
  const hint =
    'A share link starts with v=1, such as #v=1&alg=dijkstra&in=A-B%204.';
  if (v === undefined)
    return fail('INVALID_LINK', '$.v', 'The link has no version (`v`)', hint);
  if (!/^[1-9][0-9]{0,8}$/.test(v))
    return fail(
      'INVALID_LINK',
      '$.v',
      `The link's version (\`v\`) must be a whole number, not ${quote(v)}`,
      hint,
    );
  if (Number(v) > SHARE_LINK_VERSION)
    return fail(
      'INVALID_LINK',
      '$.v',
      `The link was made by a newer algoviz (link format ${v}); this page reads format ${SHARE_LINK_VERSION}`,
      'Open the link with a newer algoviz share page.',
    );
  return ok(undefined);
}

// --- Compression --------------------------------------------------------------

interface ByteReader {
  read(): Promise<{ readonly done: boolean; readonly value?: Uint8Array }>;
  cancel(): Promise<void>;
}

interface ByteStream {
  readonly readable: { getReader(): ByteReader };
  readonly writable: {
    getWriter(): {
      write(chunk: Uint8Array): Promise<void>;
      close(): Promise<void>;
    };
  };
}

/** The web APIs used here, where the runtime has them. */
interface WebApis {
  readonly CompressionStream?: new (format: 'deflate-raw') => ByteStream;
  readonly DecompressionStream?: new (format: 'deflate-raw') => ByteStream;
  readonly TextEncoder?: new () => { encode(text: string): Uint8Array };
  readonly TextDecoder?: new (
    label: 'utf-8',
    options: { fatal: boolean },
  ) => { decode(bytes: Uint8Array): string };
}

const web = globalThis as WebApis;

const noStreams = () =>
  fail(
    'INVALID_LINK',
    '$.doc',
    'This JavaScript runtime cannot compress or inflate documents: it has no CompressionStream',
  );

async function deflate(json: string): Shared<string> {
  if (!web.CompressionStream || !web.TextEncoder) return noStreams();
  const bytes = new web.TextEncoder().encode(json);
  const packed = await pipe(new web.CompressionStream('deflate-raw'), bytes);
  return ok(toBase64url(packed ?? new Uint8Array()));
}

async function inflate(payload: string): Shared<unknown> {
  if (payload === '')
    return fail(
      'INVALID_LINK',
      '$.doc',
      '`doc` is empty: it holds no document',
    );
  if (!/^[A-Za-z0-9_-]*$/.test(payload) || payload.length % 4 === 1)
    return fail(
      'INVALID_LINK',
      '$.doc',
      '`doc` is not base64url text: it has a character other than A–Z, a–z, 0–9, "-" and "_", or one too many',
      'Copy the whole link: a link cut short or changed by hand no longer holds its document.',
    );
  if (!web.DecompressionStream || !web.TextDecoder) return noStreams();
  let bytes: Uint8Array | undefined;
  try {
    bytes = await pipe(
      new web.DecompressionStream('deflate-raw'),
      fromBase64url(payload),
      SHARE_LIMITS.documentBytes,
    );
  } catch (e) {
    return fail(
      'INVALID_LINK',
      '$.doc',
      `\`doc\` is not a document compressed with raw DEFLATE: ${e instanceof Error ? e.message : String(e)}`,
      'Copy the whole link: a link cut short or changed by hand no longer holds its document.',
    );
  }
  if (bytes === undefined)
    return fail(
      'LINK_TOO_LARGE',
      '$.doc',
      `\`doc\` inflates to more than ${SHARE_LIMITS.documentBytes / 1024 / 1024} MiB, the most a share page reads`,
    );
  let json: string;
  try {
    json = new web.TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return fail(
      'INVALID_LINK',
      '$.doc',
      '`doc` does not inflate to UTF-8 text',
    );
  }
  try {
    return ok(JSON.parse(json) as unknown);
  } catch (e) {
    return fail(
      'INVALID_LINK',
      '$.doc',
      `\`doc\` does not hold JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/**
 * Runs bytes through a compression stream; undefined once the output
 * passes `limit`, which stops the stream there.
 */
async function pipe(
  stream: ByteStream,
  bytes: Uint8Array,
  limit = Infinity,
): Promise<Uint8Array | undefined> {
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  // The reader reports a failure; the writer's own rejection is the same.
  writer
    .write(bytes)
    .then(() => writer.close())
    .catch(() => undefined);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done || value === undefined) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      return undefined;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
}

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** base64url (RFC 4648, section 5) without padding. */
function toBase64url(bytes: Uint8Array): string {
  const out: string[] = [];
  for (let i = 0; i < bytes.length; i += 3) {
    const n =
      (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    // One byte makes two characters, two make three, three make four.
    const chars = Math.min(bytes.length - i, 3) + 1;
    for (let k = 0; k < chars; k++)
      out.push(ALPHABET[(n >> (18 - 6 * k)) & 63]!);
  }
  return out.join('');
}

/** Decodes base64url text already checked to use only its alphabet. */
function fromBase64url(text: string): Uint8Array {
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let at = 0;
  for (let i = 0; i < text.length; i++) {
    buffer = ((buffer << 6) | ALPHABET.indexOf(text[i]!)) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[at++] = (buffer >> bits) & 0xff;
    }
  }
  return out;
}

// --- Helpers -----------------------------------------------------------------

function fail(
  code: ShareErrorCode,
  path: string,
  message: string,
  hint?: string,
): Result<never, readonly ShareDiagnostic[]> {
  return err([
    { code, path, message, ...(hint === undefined ? {} : { hint }) },
  ]);
}

/** 16384 as "16,384", without Intl, which the Typst plugin lacks. */
const thousands = (n: number): string =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const quote = (text: string): string =>
  JSON.stringify(text.length > 40 ? `${text.slice(0, 40)}…` : text);
