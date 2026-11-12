# 0036. A linked-list node can move along the row

## Status

Accepted

## Context

Phase 2's move-to-front entry (roadmap S7, CLRS 4th edition, chapter 27) keeps a list and, on each request, finds the requested element and moves it to the front. The `linkedList` kind (`packages/spec/src/kinds/linked-list.ts`) draws nodes in a row with `next` (and `prev`) links that are independent of the row: a reversal rewires one pointer at a time while nodes stay in place.

The kind can insert and remove a node, but not move one. Moving an element to the front today means removing its node and inserting a new one with another id, so the drawing shows one node vanishing and another appearing instead of the element travelling to the front, and the element's marks are lost.

## Decision

The `linkedList` kind gains one action, `move`, in protocol version **0.7** (ADR 0021), the version after the `btree` kind's 0.6 (ADR 0035): a feature `list moves` in `PROTOCOL_FEATURES`, used by any document with a `move` action on a `linkedList` structure.

| Action | Fields       | Effect                                                                                                                        |
| ------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `move` | `from`, `to` | Move the node at row position `from` to position `to`, the nodes between shifting one place, as an element moves in an array. |

- **Positions.** `from` and `to` are row positions of existing nodes, from 0 to n − 1 for a list of n nodes; `to` is the node's position after the move. `from` equal to `to` changes nothing. Either out of range is `OUT_OF_RANGE` with the path `['from']` or `['to']`, so every `move` on an empty list is refused.
- **Links do not change.** As everywhere in this kind, links are independent of the row: a node keeps its `next` and `prev` and so do the others, and the arrows follow the nodes. A recipe that moves an element in the list also relinks it with `link` in the same step, so the step's picture is a list again. In a doubly linked list that includes the `prev` links; in a circular one, the link from the last node.
- **Actions in a step see the row as it is.** Actions apply in order, so a `link` after a `move` in the same step counts positions in the row after the move. For example, in the list `4 2 7 1` (positions 0 to 3), moving `7` to the front is `move { from: 2, to: 0 }`, giving the row `7 4 2 1`; then `link { from: 2, to: 3 }` joins `2` to `1`, `link { from: 0, to: 1 }` points `7` at the old head `4`, and `pointer { name: "head", index: 0 }`.
- **Marks follow the nodes.** The moved node keeps its id, its visits, settled mark and the pointers at it, and so do the nodes that shift: these marks are kept by node id and need nothing. The step's highlights are kept by row position, so `move` reindexes them with a third reindexing next to `afterInsert` and `afterRemove` in `common.ts`: position `from` goes to `to`; for `from < to` the positions after `from` up to `to` go down by one; for `from > to` the positions from `to` up to before `from` go up by one; the rest stay. It is a bijection of 0 to n − 1, tested as one.
- **Drawing.** Nodes are keyed by id, so the moved node slides to its place and the others shift; no painter changes. The `next` arrows are drawn from the new positions, so the gallery check includes a move across a full row of 12 nodes.

### The module

`move-to-front` (topic lists, CLRS 4th edition, chapter 27): a singly linked, non-circular list of distinct keys and a sequence of requests. The input schema declares `list` and `requests` as lists in the notation of ADR 0032 (`list: "4 2 7 1"`, `requests: "7 7 1 4"`).

- **Bounds.** 1 to 12 keys, so the list fits on one row as in list reversal, and 1 to 32 requests. An empty list, no requests, too many of either, a key given twice in `list`, and a request for a key not in the list are refused with a message naming the problem.
- **Search.** For each request the walk starts at the head and compares node by node, a pointer `x` on the node it reads. Finding the key at position r (counting from 1) costs r.
- **Move.** The found node then moves to the front in one step, as in the example above: `move` to position 0, `link` steps joining its old predecessor to its old successor (or to nothing, if it was last) and pointing it at the old head, and `head` moved to it. When r = 1 the node is already the head: the step says so and changes nothing.
- **Cost.** Moving the node to the front by swaps of neighbours takes r − 1 swaps; counting each swap as 1, the request costs r + (r − 1) = 2r − 1. The one `move` action only draws the result; it is not the cost.
- **The table.** A side table (`place: "side"`, ADR 0029) has a row per request and the columns `request`, `search` (r), `move` (r − 1) and `cost` (2r − 1), filled with `set` as each request ends; the last step gives the totals.

### Tests

- Spec: the action's fields, the feature and version 0.7; fixtures.
- Core: the reducer for `move` against hand-computed states, forwards and backwards, with marks and pointers following their nodes, and `move` in the list model of the property tests; the highlight reindexing as a bijection; the scene keeps each node's key.
- Module: costs and final order against an independent move-to-front, the edge cases above, property tests on random lists and requests, and a look at it in the gallery.

### Rejected

- **`move` that also relinks the list** by row neighbours. It would only be right while the links follow the row, which the kind deliberately does not require (a reversal in progress does not), so a recipe that wants both says so with `link`.
- **A `moveToFront` action.** Moving to the front is one case of moving; `move` also draws transpose and other self-organizing lists.
- **`from` and `to` as node ids.** Every other `linkedList` action names nodes by row position, and so does `move`.

## Consequences

- Move-to-front draws the element travelling to the front with its marks, and the list stays a list in every step.
- **Public interfaces:** protocol 0.7: `move` on `linkedList`; the MCP guide's `kinds/linkedList.md`.
