# 0036. A linked-list node can move along the row

## Status

Accepted

## Context

Phase 2's move-to-front entry (roadmap S7, CLRS 4th edition, online algorithms) keeps a list and, on each request, finds the requested element and moves it to the front. The `linkedList` kind (`packages/spec/src/kinds/linked-list.ts`) draws nodes in a row with `next` (and `prev`) links that are independent of the row: a reversal rewires one pointer at a time while nodes stay in place.

The kind can insert and remove a node, but not move one. Moving an element to the front today means removing its node and inserting a new one with another id, so the drawing shows one node vanishing and another appearing instead of the element travelling to the front, and the element's marks are lost.

## Decision

The `linkedList` kind gains one action, `move`, in protocol version **0.7** (ADR 0021): a feature `list moves`, used by any document with such an action.

| Action | Fields       | Effect                                                                                                                        |
| ------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `move` | `from`, `to` | Move the node at row position `from` to position `to`, the nodes between shifting one place, as an element moves in an array. |

- Positions are counted as `remove` and `insert` count them: `to` is the node's position after the move, from 0 to the last position. `from` equal to `to` changes nothing.
- **Links do not change.** As everywhere in this kind, links are independent of the row: a node keeps its `next` and `prev` and so do the others, and the arrows follow the nodes. A recipe that moves an element in the list also relinks it with `link` in the same step, so the step's picture is a list again.
- **Marks follow the nodes.** The moved node keeps its id, its visits, settled mark and the pointers at it, and so do the nodes that shift: these marks are kept by node id and need nothing. The step's highlights are kept by row position, so `move` reindexes them, as `insert` and `remove` already do.
- Errors: `from` or `to` out of range (`OUT_OF_RANGE`, with the path of the field).
- **Drawing.** Nodes are keyed by id, so the moved node slides to its place and the others shift; no painter changes.

### The module

`move-to-front` (topic lists, CLRS 4th edition, chapter 27): a singly linked list of distinct keys and a sequence of requests, in the list notation of ADR 0032 (`list: "4 2 7 1"`, `requests: "7 7 1 4"`); at most 12 keys, so the list fits on one row as in list reversal, and 32 requests.

- For each request the walk starts at the head and compares node by node, a pointer `x` on the node it reads. Finding the key at position r (counting from 1) costs r.
- The found node then moves to the front in one step: `move` to position 0, `link` steps joining its old neighbours and pointing it at the old head, and `head` moved to it. Moving it there by swaps of neighbours would take r − 1 swaps, which the table counts as the move's cost.
- A side table (ADR 0029) lists each request with its search cost r, its move cost r − 1 and their sum; the last step gives the totals.
- A request for a key not in the list is refused, naming the key.

### Tests

- Spec: the action's fields, the feature and version 0.7; fixtures.
- Core: the reducer for `move` against hand-computed states, forwards and backwards, with marks and pointers following their nodes, against the list model of the property tests; the scene keeps each node's key.
- Module: costs and final order against an independent move-to-front, property tests on random lists and requests, and a look at it in the gallery.

### Rejected

- **`move` that also relinks the list** by row neighbours. It would only be right while the links follow the row, which the kind deliberately does not require (a reversal in progress does not), so a recipe that wants both says so with `link`.
- **A `moveToFront` action.** Moving to the front is one case of moving; `move` also draws transpose and other self-organizing lists.

## Consequences

- Move-to-front draws the element travelling to the front with its marks, and the list stays a list in every step.
- **Public interfaces:** protocol 0.7: `move` on `linkedList`; the MCP guide's `kinds/linkedList.md`.
