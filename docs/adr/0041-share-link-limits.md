# 0041. Share links: tighter reader limits, a stricter base, an origin of its own

## Status

Accepted. Amends [ADR 0040](0040-share-links.md), section 5 (limits), section 4 (unknown keys) and section 8 (the base URL).

## Context

The security and code reviews of the share page (roadmap 3.3) found that some of ADR 0040's limits leave more room than any real link needs:

- **Memory.** The page inflates a document up to 16 MiB before `JSON.parse`. A 20 KB fragment that inflates to 15.6 MB of `[{},{},…]` took 350 ms and about 360 MB of heap to parse in a probe. Only the tab that opens the link pays, but on a phone that can be enough to crash it. Real documents are far smaller: the largest of the registry's runs measured in ADR 0040 is 1.08 MB of JSON (`floyd-warshall` on 20 nodes), and a link that a writer makes, at most 16,384 characters, holds about 12 KB of compressed data, which for real documents, compressing five to fifteen times (ADR 0040), is well under 1 MB.
- **`in`.** `alg`, `frame` and `theme` have a length cap, 200 characters, which ADR 0040 does not list; `in` has none besides the fragment's 2,097,152 characters. Every recipe's input schema refuses long inputs quickly today, but a reader limit should not depend on every future recipe doing so.
- **Unknown keys.** ADR 0040 says readers ignore keys they do not know, but the reader decoded every pair before looking at its key, so a newer link whose unknown key held percent-encoding this reader cannot decode, or a bare key without `=`, failed as a whole.
- **The base URL.** The writer accepted a base with a user name or password, a backslash or control characters. Only the server's own configuration sets the base, never a request, so this is hygiene rather than an attack.
- **The origin.** A Content Security Policy of `'self'` is only as strong as the origin is clean: on a shared origin, such as a `github.io` user site, any other page there could host a script the policy allows.

## Decision

### Limits

ADR 0040's table becomes:

| Limit                              | Value                   | Past it                                          |
| ---------------------------------- | ----------------------- | ------------------------------------------------ |
| A link that a writer makes         | 16,384 characters       | the writer makes no link and says why            |
| A fragment that the page reads     | 2,097,152 characters    | `LINK_TOO_LARGE`, before decoding                |
| `alg`, `frame` or `theme`, decoded | 200 characters          | `INVALID_LINK`                                   |
| `in`, decoded                      | 65,536 characters       | `LINK_TOO_LARGE`                                 |
| A document after inflating         | 4 MiB of UTF-8          | `LINK_TOO_LARGE`, as soon as inflating passes it |
| The document itself                | the protocol's `LIMITS` | the parser's diagnostics                         |

4 MiB is four times the largest document the registry produces and many times what a writer's link can hold, and it bounds the parse to about a quarter of what 16 MiB allowed. 65,536 characters is four times the longest link a writer makes.

A writer also stops compressing once the compressed document can no longer fit in the link, so a document far too large for a link costs only the work up to that point.

### Unknown keys

A reader looks at a pair's key first. A pair whose key is not one it knows is skipped without decoding its value, and so is a bare key without `=`. Only the keys it knows must be well formed. This is what ADR 0040's section 4 meant, now stated.

### The base URL

A base must be an absolute `http:` or `https:` URL with a host, and without a fragment, a user name or password, a backslash, spaces or control characters.

### An origin of its own

The site, and with it the share page, is served from an origin of its own: its own domain or subdomain, not a path on an origin that serves other people's pages. The owner picks it with the domain (ADR 0040, section 8).

## Consequences

- No link a writer makes changes meaning or stops opening: every limit that tightens stays well above what writers produce.
- A crafted link costs a tab at most about a quarter of what it could before.
- The reader's limits are all in one table again.
