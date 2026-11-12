# 0040. Share links carry a document, or an algorithm and its input, in the URL fragment

## Status

Accepted

## Context

A share link opens a visualization in the player, for anyone, with nothing installed (requirements, use case 4). Requirement R9 adds that no server stores the document: the link itself carries it. Roadmap 3.3 builds the page that reads such links and has the MCP tools return one next to the document they show.

The link format becomes a public API the day the first link is pasted into a chat or a set of notes, and links live as long as the notes do. So the format, its version marker and its limits are decided here, before any code.

Two kinds of content need a link:

- **A document**, written by a model or by hand. Only the document itself can reproduce it, so the link carries all of it, compressed.
- **An algorithm of the registry and its input**, such as `dijkstra` on `A-B 4, B-C 1`. ADR 0032 made this the shortest path to a figure everywhere else; a link can carry the same two things, which is much shorter than the document they produce and can be read and written by hand.

Sizes, measured on 2026-11-12 with every example of the registry (176 runs) and with the largest inputs the recipes accept. "Link" is the base64url text of the document's JSON compressed with raw DEFLATE at the default level:

| Content                                    | JSON     | Link          |
| ------------------------------------------ | -------- | ------------- |
| smallest example (`stack.pop`)             | 0.9 KB   | 567 chars     |
| median example (`disjoint-set`)            | 7.4 KB   | 1,560 chars   |
| 90th percentile (`lup-decomposition`)      | 9.0 KB   | 2,631 chars   |
| 99th percentile (`optimal-bst`)            | 22.9 KB  | 4,758 chars   |
| largest example (`strassen`)               | 58.7 KB  | 7,154 chars   |
| `merge-sort` on 32 values                  | 105.1 KB | 10,615 chars  |
| `insertion-sort` on 32 values (730 steps)  | 166.5 KB | 12,438 chars  |
| `dijkstra` on 40 nodes and 109 edges       | 67.0 KB  | 9,291 chars   |
| `floyd-warshall` on 20 nodes (4,824 steps) | 1,078 KB | 113,411 chars |

The same runs as algorithm links are about 150 to 1,900 characters, since they carry only the input. Documents compress about five to one; Brotli would make them 18% shorter than DEFLATE.

## Decision

### 1. The page

The share page is a static page, `play/` of the documentation site (roadmap 3.4), built by a new workspace, `apps/site`. It holds one `<algo-player>`, reads the URL fragment, and shows what the fragment names. It makes no network request besides its own files (scripts, fonts and the registry's chunk), so any static host can serve it, at any path: Cloudflare Pages, a Worker's assets, GitHub Pages, or a local preview server. It reads the fragment again when it changes (`hashchange`), so editing a link in the address bar works.

An empty fragment shows a short note on what the page is for. A fragment the page cannot read shows its errors, as the player's error panel does for a document: each with a code, a message and a hint.

### 2. The fragment

A fragment is a list of `key=value` pairs separated by `&`, as a query string is:

```text
#v=1&doc=<the document, compressed and in base64url>
#v=1&alg=dijkstra&in=A-B%204%2C%20B-C%201&frame=improve%233
```

| Key     | Value                                                                                                                 |
| ------- | --------------------------------------------------------------------------------------------------------------------- |
| `v`     | The link format's version: `1`. Required.                                                                             |
| `doc`   | A document, compressed (section 3).                                                                                   |
| `alg`   | A registry id (ADR 0019), such as `dijkstra` or `bst.delete`.                                                         |
| `in`    | The algorithm's input, as text read by `readInput` (ADR 0032, section 4). Left out, the first example.                |
| `frame` | The frame to open on: a number or a selector (ADR 0020), as the player's `frame` attribute takes. Default 0.          |
| `theme` | A theme as the player's `theme` attribute takes: a built-in name, `auto`, or a day and a night theme. Default `auto`. |

- A link has `doc` or `alg`, not both; `in` goes only with `alg`.
- Keys and values are percent-encoded UTF-8 (RFC 3986), decoded with `decodeURIComponent`: `+` is a plus sign, not a space, so an input such as `1e+9` survives a hand-written link. Writers encode every value with `encodeURIComponent`.
- Keys may come in any order; writers put `v` first and the content second. A key given twice is an error, so a link never means two things.
- Readers ignore keys they do not know (section 4).

The algorithm form shows what the page's registry draws today, not a frozen copy. That is what the notes that name `dijkstra` in Typst or LaTeX already rely on: registry ids and inputs are public, and step names stay valid when the code behind them changes (R3), so a link's `frame` keeps pointing at the same step. A link that must show exactly one document uses `doc`.

### 3. Compression

`doc` is the document's JSON text, encoded as UTF-8, compressed with raw DEFLATE (RFC 1951, no zlib or gzip wrapper), and written in base64url (RFC 4648, section 5) without padding, which needs no percent-encoding.

- **Raw DEFLATE** is the one format that every browser the player supports, Node.js and Cloudflare Workers all decompress natively, through `DecompressionStream('deflate-raw')`. The page then carries no compression library, and the MCP server compresses with `CompressionStream` wherever it runs. The zlib and gzip wrappers would add 6 and 18 bytes of headers and checksums that a link does not need: a damaged payload already fails to inflate, to parse as JSON, or to validate.
- **Brotli** is 18% shorter on the measurements above, but `DecompressionStream` does not take it in every supported browser yet. A later version of the format can add it under a new key (section 4).
- **lz-string**, which some playgrounds use, needs a library at both ends and compresses JSON less well than DEFLATE.

### 4. The version marker

`v` is the version of the link format, independent of the document's own `version` (ADR 0021): a `doc` link carries a document of any protocol version the page reads.

- A reader takes `v=1`. A link without `v` is refused, and so is any other value, with a message: a larger number was made by a newer algoviz, and opens in a newer page.
- New optional keys, such as a code language or a layout, do not change `v`: readers ignore keys they do not know, so an older page still shows the content and leaves the new key out. A new way to carry content, such as Brotli, is a new key next to `doc`, also without a new `v`, since an older reader then says it finds no content rather than misreading it.
- `v` changes only when a key it already has changes meaning or encoding. Readers keep reading every older `v`, as the parser reads every older protocol version, because links live in notes.

### 5. Size limits

| Limit                          | Value                   | Past it                                          |
| ------------------------------ | ----------------------- | ------------------------------------------------ |
| A link that a writer makes     | 16,384 characters       | the writer makes no link and says why            |
| A fragment that the page reads | 2,097,152 characters    | `LINK_TOO_LARGE`, before decoding                |
| A document after inflating     | 16 MiB of UTF-8         | `LINK_TOO_LARGE`, as soon as inflating passes it |
| The document itself            | the protocol's `LIMITS` | the parser's diagnostics, as for any document    |

- **Writers stop at 16,384 characters.** That fits every example of the registry as a document, with twice the largest to spare, and most recipes on their largest inputs. Longer links are hard to paste into chats and mail, and expensive in a model's context, where base64 costs about one token per two or three characters. Algorithm links are short whatever the run's size, so the limit binds only documents. Past it, the MCP tools say that the document is too large for a link and to give the user the document instead, or to show a recipe, whose link carries only its input.
- **The page reads up to 2,097,152 characters**, the longest URL Chrome keeps; a longer one could not have reached it intact. It inflates as a stream and stops at 16 MiB, so a crafted payload that inflates a thousandfold cannot exhaust memory. The document then meets the protocol's `LIMITS` like any other.

### 6. The fragment, not the query

The content goes after `#`, not after `?`:

- **It never reaches a server.** Browsers do not send the fragment in requests, nor in the `Referer` header (RFC 3986, section 3.5; the Referrer Policy standard strips it). So no host, CDN, proxy log or analytics tool sees a document, and none could store it: R9 holds by construction, not by policy.
- **Any static host serves it.** The page is one file whose URL never changes, so it caches forever, and no server rule or function has to read the query.
- **No server limit applies.** Servers and CDNs cap the length of the request line, often at 8 to 16 KB, which would cut the larger documents off; the fragment only has to fit in the browser.

What the fragment does not hide: the browser keeps it in its history and syncs it, and anyone with the link can read the document. A share link publishes its content to whoever receives it; it is not a place for secrets.

### 7. The page renders untrusted content

Anyone can write a fragment, so the page treats it as untrusted input, and nothing in it becomes markup or code:

- The fragment is split into strings. `doc` is inflated and read with `JSON.parse`, which makes data only; the document then goes through the spec parser and the replay of every step (`loadTrace`), as any document does, with the protocol's limits. `alg` and `in` go through `readInput` and the module's input schema.
- Labels, narration, titles and code are drawn as text. The painters escape every text and attribute value they write (`serializeNode`); tag and attribute names come from the painters' code, never from a document; the player's chrome uses Lit's text bindings; nothing uses `unsafeHTML`.
- No value from the fragment becomes a URL, an attribute or HTML on the page. `frame` and `theme` are set as player properties, which check them; an unknown theme falls back to `auto`, and a bad selector shows the player's frame error.
- The page sends a Content Security Policy, in its `_headers` file and a `<meta>` tag: scripts, styles, fonts and connections from its own origin only, no plugins, no `<base>` and no forms. A bug that let markup through would still run no script. Framing stays allowed, so a course page can embed a link in an iframe: the page has no action that a framing page could trick a click into.
- Tests prove it: end-to-end tests open crafted links, with markup and script in labels, narration, titles, step names, ids and inputs, and check that the text shows as typed, that no element or script was added, and that no dialog opened; unit tests feed the reader malformed percent-encoding, base64, DEFLATE and JSON, wrong versions, repeated keys and an inflation bomb.

### 8. Where links come from

The base URL of share links is the page's own URL, such as `https://example.org/play/`. Where the site lives is the owner's decision, not made yet, so **no code assumes a domain**:

- The MCP server reads the base from `ALGOVIZ_SHARE_URL`, over stdio and over HTTP (`algoviz-mcp --http`, ADR 0039). `createServer` and `createHttpHandler` take it as an option, `shareUrl`, which the Worker of roadmap 3.2 sets from its own environment. Without one, the tools make no links and say nothing about them. A base that is not an absolute `http:` or `https:` URL, or that has a fragment, stops the server at start with a message, since links made from it would all be broken.
- The documentation site (3.4) links each algorithm to the page with a relative URL, `../play/#v=1&alg=…`, which needs no base.

The codec lives in `@algoviz/spec`, next to the document format it carries: `shareFragment(content)` writes a fragment, `shareLink(base, content)` a whole link within the writers' limit, and `readShareFragment(text)` reads one. Its errors are diagnostics with the codes `INVALID_LINK` and `LINK_TOO_LARGE`. `writeInput(value)` in `@algoviz/recipes`, the inverse of `readInput`, writes an input as text: a string that `readInput` reads back unchanged stays as it is, and anything else becomes JSON.

### 9. MCP

The tools stay synchronous and independent of any transport (ADR 0039): a tool's result names the content to link, and `createServer` turns it into a link, since compressing with `CompressionStream` is asynchronous.

- **`algoviz_show`** returns the link of what it shows, as a second text item after its message: a recipe's link names the recipe and its input; a document's carries the document; `frame` is in the link when it is not 0. Hosts without MCP Apps only get text, and the link is what the model gives the user there. The server's instructions say so.
- **`algoviz_run_recipe`** returns the recipe's link next to the document, as a second text item, so the document's JSON text stays a JSON text.
- `algoviz_validate`, `algoviz_inspect` and `algoviz_render` return none. A model calls them many times while it writes a document, and a link there would cost context for nothing; it shows the document once, with `algoviz_show`.

## Consequences

- A document or a run opens anywhere from one link, and no server ever holds it. Algorithm links are short enough to write by hand, in notes, slides or a message.
- The format is public from the first link: keys keep their meaning, readers keep every `v`, and new content goes in new keys. Accepted ADRs are not edited, so a change of format is a new ADR.
- The player bundle does not grow: the codec is not part of `<algo-player>`, and only the share page and the MCP server import it. The share page is the player plus the codec, served with the registry's chunk.
- Algorithm links show what the current registry draws. That is the intent, and step names keep their frames; a link that must never change is a document link.
- Documents beyond 16,384 characters of link have none. The measurements put every example and most full-size runs inside it; larger documents are shared as files, or as the recipe and input that made them.
- The deployed site's address, and so the base of every link, waits for the owner. Until then the tools make no links, and the page is built and tested locally.
