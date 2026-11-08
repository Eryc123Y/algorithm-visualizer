# 0031. Marks, notes and pointer bands that read in every frame

## Status

Accepted

## Context

Roadmap 1.7 collects drawing faults found while building the themes (1.6) and the auxiliary structures (1.8). Most are fixes inside layout and the painters, but three change what earlier decisions recorded:

- **Pointer bands** (ADR 0008). An array or a linked list reserves the room below it for its pointer badges over the whole trace, so nothing moves when a pointer comes and goes. Frames without pointers, such as the first and last of insertion sort, then show a blank band, and in the narrow layout the structure below sits far away. ADR 0025 must hold: every figure of a series has one size and one scale.
- **The heap view** (ADR 0029) links every element of the array into the tree. Heapsort moves the maximum past the heap and settles it there; CLRS draws those elements apart from the tree, and the view keeps them linked as if they were still in the heap.
- **One role per element** (ADR 0009, 0012). A scene item has one role, and the strongest wins: a settled vertex that is also highlighted, as when Dijkstra looks back at a finished vertex, is drawn as highlighted only, and loses its check mark, the one cue of `settled` that is not colour.

The others change no decision: check marks that stick out of circles, edge weights that later edges cross, node notes and heap indices over edges, notes that drift away at diagonals, and the player's fixed radii.

## Decision

### Pointer bands open where pointers are

A structure's pointer band is open from the first frame in which the structure has a pointer to the last such frame, and closed before and after that span. The band's height inside the span is still measured over the whole trace (ADR 0008), so within a run nothing moves when pointers come and go; a structure below moves at most twice, when the band opens and when it closes, and the player animates it like any move.

- The canvas is still the largest over every frame (ADR 0025): every figure of a series keeps one size and one scale, and only the content of the first and last frames sits higher in it.
- It applies to the bands below arrays drawn as rows (alone or under a heap) and below linked lists. Badges beside nodes of graphs and trees take room to the left, which does not change.
- The span is measured once over the trace, from each frame's own pointers, so a frame's figure still depends only on the document and the frame.

### Settled elements leave the heap

In the heap view (and the tree view) of an array, the edge between two positions is drawn only while neither element is settled. A settled element keeps its node where it is, so the shape stays put, and its cell in the row keeps its check mark. Heapsort, which settles each maximum it moves to the end, therefore shows the sorted part apart from the tree, as CLRS does. Documents need no new field: `settle` already says that an element is in its final place, which for a heap means outside it.

### Settled shows under every mark

Scene nodes and boxes gain an optional `settled: true` when the element is settled but a stronger, transient role (compare, swap, highlight) is drawn. Painters draw the check mark for `settled` items whatever their role, in the colour of the item's text, which every theme already gives 4.5:1 on the item's fill. Items whose role is `settled` keep the theme's `settledMark`. The field is optional, so documents and scenes without the combination do not change.

### Text clear of lines

- **Check marks** on nodes lie inside the circle or stadium, less its border, in the quarter above and right of the value; their size follows the radius.
- **Edge labels** are painted after every edge of their structure, so their halo covers the lines they sit on. Layout also moves a label along its edge, as it does to keep labels apart (ADR 0013), until its box clears other edges where a nearby position does.
- **Node notes** (a distance, a rank, a height) sit a fixed gap outside the node's outline in their direction, so a note at a diagonal is as close as one above. Layout picks the direction, in an order of preference, as the first whose note box clears every edge and every other node, measured with the widest note of the trace so that the direction does not change from frame to frame; failing that, the clearest. Trees choose among above, above left and above right, where they reserve room.
- **Heap indices** are notes of their positions: above the node, or above left or above right, away from the edges, as CLRS numbers its heaps.

### Radii in the chrome

The player's buttons, language menu and variable chips take `--algo-control-radius`, and its code panel and error box `--algo-panel-radius`, next to the existing `--algo-radius` of the container. Each built-in theme sets them, so square themes (the answer sheet, Turbo C) have square controls.

## Tests

- Property tests on random scenes and documents: every check mark lies inside its node; a note or an edge label crosses an edge only when every candidate place does; pointer bands are open exactly over their span, and every figure of a series keeps one size.
- Unit tests for each fault, written to fail first, and the scene invariants over every fixture and registry example.
- Every theme and output: SVG, the player, TikZ, Typst and LaTeX, as for 1.6.

## Consequences

- The first and last frames of a run with array pointers draw their structures closer together, and the run moves them once at each end.
- Heapsort and the heap operations read as CLRS draws them; a document that settles elements of a heap view for another reason sees them detached too.
- `SceneNode.settled` and `SceneBox.settled`, `--algo-control-radius` and `--algo-panel-radius` are new public names.
- Notes and edge labels may sit in other places than before, and layout fixtures that pin them change.
