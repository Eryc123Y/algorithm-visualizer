/**
 * Share links (ADR 0040): the fragment's syntax, the compression of
 * documents, the version marker and the size limits.
 */
import { describe, expect, it } from 'vitest';

import {
  checkShareBase,
  readShareFragment,
  SHARE_LIMITS,
  shareFragment,
  shareLink,
  type ShareContent,
} from '../src/index.ts';

const doc = {
  version: '1.0',
  title: 'Push <b>1</b> & "2"',
  structures: { s: { kind: 'stack', initial: [] } },
  steps: [{ actions: [{ target: 's', type: 'push', value: 1 }] }],
};

/** base64url of raw DEFLATE, as the format writes `doc`. */
async function deflate(text: string | Uint8Array): Promise<string> {
  const bytes =
    typeof text === 'string' ? new TextEncoder().encode(text) : text;
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
  const out = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = '';
  for (const b of out) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function fragmentOf(content: ShareContent): Promise<string> {
  const result = await shareFragment(content);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

async function read(fragment: string) {
  const result = await readShareFragment(fragment);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

async function failure(fragment: string) {
  const result = await readShareFragment(fragment);
  if (result.ok) throw new Error(`read ${JSON.stringify(result.value)}`);
  expect(result.error).toHaveLength(1);
  return result.error[0]!;
}

describe('shareFragment', () => {
  it('writes a document compressed, after the version', async () => {
    const fragment = await fragmentOf({ document: doc });
    expect(fragment).toMatch(/^v=1&doc=[A-Za-z0-9_-]+$/);
    expect(await read(fragment)).toEqual({ document: doc });
  });

  it('writes an algorithm and its input as text', async () => {
    const fragment = await fragmentOf({
      algorithm: 'dijkstra',
      input: 'A-B 4, B-C 1',
      frame: 'improve#3',
      theme: 'textbook textbook-dark',
    });
    expect(fragment).toBe(
      'v=1&alg=dijkstra&in=A-B%204%2C%20B-C%201&frame=improve%233&theme=textbook%20textbook-dark',
    );
    expect(await read(fragment)).toEqual({
      algorithm: 'dijkstra',
      input: 'A-B 4, B-C 1',
      frame: 'improve#3',
      theme: 'textbook textbook-dark',
    });
  });

  it('leaves out an absent input, frame 0 and an absent theme', async () => {
    expect(await fragmentOf({ algorithm: 'bfs' })).toBe('v=1&alg=bfs');
    expect(await fragmentOf({ algorithm: 'bfs', frame: 0 })).toBe(
      'v=1&alg=bfs',
    );
    expect(await fragmentOf({ algorithm: 'bfs', frame: -1 })).toBe(
      'v=1&alg=bfs&frame=-1',
    );
    expect(await fragmentOf({ algorithm: 'bfs', input: '' })).toBe(
      'v=1&alg=bfs&in=',
    );
  });

  it('refuses text with a lone surrogate, which has no UTF-8', async () => {
    const result = await shareFragment({ algorithm: 'a', input: 'x\ud800' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error[0]).toMatchObject({
      code: 'INVALID_LINK',
      path: '$.in',
    });
  });

  it('refuses a document that is not JSON, without throwing', async () => {
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    for (const document of [
      undefined,
      1n,
      cyclic,
      {
        toJSON: () => {
          throw new Error('no');
        },
      },
    ]) {
      const result = await shareFragment({ document });
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error[0]).toMatchObject({
        code: 'INVALID_LINK',
        path: '$.doc',
      });
    }
  });

  it('keeps every character of an input', async () => {
    const input = '{"x": "a+b & c=d #e %f ü 中 😀"}';
    expect(await read(await fragmentOf({ algorithm: 'a', input }))).toEqual({
      algorithm: 'a',
      input,
    });
  });
});

describe('readShareFragment', () => {
  it('reads nothing from an empty fragment', async () => {
    expect(await read('')).toBeUndefined();
    expect(await read('#')).toBeUndefined();
  });

  it('takes the fragment with or without its #', async () => {
    expect(await read('#v=1&alg=bfs')).toEqual({ algorithm: 'bfs' });
  });

  it('reads keys in any order and ignores unknown keys', async () => {
    expect(await read('frame=2&alg=bfs&lang=python&v=1&')).toEqual({
      algorithm: 'bfs',
      frame: '2',
    });
  });

  it('skips unknown keys without decoding them, bare ones too', async () => {
    expect(await read('v=1&alg=bfs&future=%&flag&%ZZ=1')).toEqual({
      algorithm: 'bfs',
    });
  });

  it('reads a known key written with percent-encoding', async () => {
    expect(await read('%76=1&%61lg=bfs')).toEqual({ algorithm: 'bfs' });
  });

  it('reads + as a plus sign', async () => {
    expect(await read('v=1&alg=a&in=1e+9')).toEqual({
      algorithm: 'a',
      input: '1e+9',
    });
  });

  it('reads a document written elsewhere with raw DEFLATE', async () => {
    const payload = await deflate(JSON.stringify(doc));
    expect(await read(`v=1&doc=${payload}`)).toEqual({ document: doc });
  });

  it.each([
    ['alg=bfs', /no version/i],
    ['v=&alg=bfs', /version/i],
    ['v=one&alg=bfs', /version/i],
    ['v=01&alg=bfs', /version/i],
    ['v=1', /neither/i],
    ['v=1&in=5', /neither/i],
    ['v=1&doc=AA&alg=bfs', /both/i],
    ['v=1&doc=AA&in=5', /`in`/],
    ['v=1&alg=bfs&alg=dfs', /twice/i],
    ['v=1&v=1&alg=bfs', /twice/i],
    ['v=1&alg', /key=value/i],
    ['v=1&alg=', /`alg`/],
    ['v=1&alg=%E0%A4%A', /percent/i],
    ['v=1&alg=bfs&in=%', /percent/i],
    ['v=1&doc=a+b', /base64url/i],
    ['v=1&doc=abcde', /base64url/i],
    ['v=1&doc=', /empty/i],
    ['v=1&doc=AAAA', /DEFLATE/],
  ])('refuses %s', async (fragment, message) => {
    const error = await failure(fragment);
    expect(error.code).toBe('INVALID_LINK');
    expect(error.message).toMatch(message);
  });

  it('says that a newer version comes from a newer algoviz', async () => {
    const error = await failure('v=2&alg=bfs');
    expect(error.code).toBe('INVALID_LINK');
    expect(error.message).toMatch(/newer/);
    expect(error.path).toBe('$.v');
  });

  it('refuses an id, a frame or a theme too long to be one', async () => {
    const long = 'x'.repeat(SHARE_LIMITS.textLength + 1);
    for (const [key, fragment] of [
      ['alg', `v=1&alg=${long}`],
      ['frame', `v=1&alg=bfs&frame=${long}`],
      ['theme', `v=1&alg=bfs&theme=${long}`],
    ]) {
      const error = await failure(fragment!);
      expect(error.path).toBe(`$.${key}`);
      expect(error.message).toMatch(/longer/);
    }
  });

  it('refuses an input longer than any writer makes', async () => {
    const at = await read(
      `v=1&alg=a&in=${'x'.repeat(SHARE_LIMITS.inputLength)}`,
    );
    expect(at).toMatchObject({ algorithm: 'a' });
    const error = await failure(
      `v=1&alg=a&in=${'x'.repeat(SHARE_LIMITS.inputLength + 1)}`,
    );
    expect(error).toMatchObject({ code: 'LINK_TOO_LARGE', path: '$.in' });
  });

  it('says what went wrong when DEFLATE gives no reason', async () => {
    const error = await failure('v=1&doc=AAAA');
    expect(error.message).toMatch(/raw DEFLATE$/);
  });

  it('refuses compressed text that is not UTF-8 or not JSON', async () => {
    const latin1 = await deflate(new Uint8Array([0x7b, 0xff, 0x7d]));
    expect((await failure(`v=1&doc=${latin1}`)).message).toMatch(/UTF-8/);
    const text = await deflate('{"version": ');
    expect((await failure(`v=1&doc=${text}`)).message).toMatch(/JSON/);
  });

  it('refuses a payload cut short', async () => {
    const payload = await deflate(JSON.stringify(doc));
    expect((await failure(`v=1&doc=${payload.slice(0, -8)}`)).message).toMatch(
      /DEFLATE/,
    );
  });

  it('refuses a fragment longer than any browser keeps', async () => {
    const error = await failure(
      `v=1&alg=bfs&x=${'a'.repeat(SHARE_LIMITS.fragmentLength)}`,
    );
    expect(error.code).toBe('LINK_TOO_LARGE');
  });

  it('stops inflating a document past its limit', async () => {
    // 5 MiB of spaces compress to about 5 KB.
    expect(SHARE_LIMITS.documentBytes).toBe(4 * 1024 * 1024);
    const bomb = await deflate(
      new Uint8Array(SHARE_LIMITS.documentBytes + (1 << 20)).fill(0x20),
    );
    expect(bomb.length).toBeLessThan(10_000);
    const error = await failure(`v=1&doc=${bomb}`);
    expect(error.code).toBe('LINK_TOO_LARGE');
    expect(error.path).toBe('$.doc');
  });
});

describe('shareLink', () => {
  const base = 'https://example.org/play/';

  it('puts the fragment after the base', async () => {
    const link = await shareLink(base, { algorithm: 'bfs', frame: 3 });
    expect(link).toEqual({
      ok: true,
      value: 'https://example.org/play/#v=1&alg=bfs&frame=3',
    });
  });

  it('keeps a query of the base', async () => {
    const link = await shareLink('http://localhost:4174/play/?x=1', {
      algorithm: 'bfs',
    });
    expect(link.ok && link.value).toBe(
      'http://localhost:4174/play/?x=1#v=1&alg=bfs',
    );
  });

  it('makes no link longer than the writers’ limit', async () => {
    const input = 'x'.repeat(SHARE_LIMITS.linkLength);
    const link = await shareLink(base, { algorithm: 'a', input });
    expect(link.ok).toBe(false);
    if (link.ok) return;
    expect(link.error[0]!.code).toBe('LINK_TOO_LARGE');
    expect(link.error[0]!.message).toContain('16,384');
  });

  it('stops compressing a document that cannot fit', async () => {
    // Random digits: about 3.3 bits each, so 1 MB stays far too large.
    let x = 11;
    const noise = Array.from({ length: 1_000_000 }, () => {
      x = (x * 48271) % 2147483647;
      return String(x % 10);
    }).join('');
    const link = await shareLink(base, { document: { noise } });
    expect(link.ok).toBe(false);
    if (link.ok) return;
    expect(link.error[0]).toMatchObject({ code: 'LINK_TOO_LARGE', path: '$' });
    expect(link.error[0]!.message).toContain('16,384');
  });

  it('fits a document whose link is just under the limit', async () => {
    const doc = { title: 'x'.repeat(100) };
    const link = await shareLink(base, { document: doc });
    expect(link.ok).toBe(true);
  });

  it('makes a link of exactly the limit', async () => {
    const prefix = `${base}#v=1&alg=a&in=`;
    const input = 'x'.repeat(SHARE_LIMITS.linkLength - prefix.length);
    const link = await shareLink(base, { algorithm: 'a', input });
    expect(link.ok && link.value.length).toBe(SHARE_LIMITS.linkLength);
  });

  it('refuses a base that is not a page’s address', async () => {
    const link = await shareLink('example.org/play', { algorithm: 'bfs' });
    expect(link.ok).toBe(false);
  });
});

describe('checkShareBase', () => {
  it.each([
    'https://example.org/play/',
    'http://localhost:4174/play/',
    'https://example.org/play/index.html?embed=1',
  ])('takes %s', (base) => {
    expect(checkShareBase(base)).toEqual({ ok: true, value: base });
  });

  it.each([
    ['', /absolute/],
    ['/play/', /absolute/],
    ['example.org/play', /absolute/],
    ['ftp://example.org/play/', /http/],
    ['javascript:alert(1)', /http/],
    ['https://example.org/play/#x', /fragment/],
    ['https://example.org/play/#', /fragment/],
    ['https://user:pass@example.org/play/', /user name/],
    ['https://example.org@evil.example/play/', /user name/],
    ['https://example.org\\play/', /backslash/],
    ['https://example.org/pl\u0007ay/', /control/],
    ['https:///play/', /absolute/],
  ])('refuses %j', (base, message) => {
    const result = checkShareBase(base);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error[0]!.code).toBe('INVALID_LINK');
    expect(result.error[0]!.message).toMatch(message);
  });
});
