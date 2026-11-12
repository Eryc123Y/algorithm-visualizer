# 0042. Table arrows join only cells that touch; a point's label gives way to badges first

## Status

Accepted

## Context

A review of every Phase 2 figure found two places where a line or a badge covers text. That breaks the rule of ADR 0031: text stays clear of lines, and marks never hide what they mark.

- **Dependency arrows in tables.** `depend` marks the cells a step reads and the cell it computes, and draws a straight arrow from each cell read to the cell computed. The guide and the schema describe it as "arrows from each". Between cells that touch, the arrow crosses nothing. Between cells further apart, it crosses every cell in between and strikes through their values:
  - rod cutting, r[6] from p[3] and r[3], crosses "10" and "13";
  - matrix-chain multiplication, m[2,5] from m[2,3] and m[4,5], crosses "4375" and "2500";
  - optimal BST and Floyd–Warshall do the same, and so does the guide's own Fibonacci table, where cell 2 reads cell 0 across cell 1.
- **A point's label in a plane.** ADR 0038 turns each label away from what is near, and puts a pointer's badge under its point. The label's direction did not count the badges, so Jarvis's march drew the badge `c` over the label `p0`.

## Decision

### Arrows only between cells that touch

`depend` draws an arrow from a cell read to the cell computed only when the two touch, by a side or a corner. A cell further away is marked as read, as every cell read already is, but gets no line. The step's narration says what is computed from what, as it does today.

This is the one rule for every output, since layout makes the arrows and every painter (the player, SVG, TikZ and Typst) draws the same scene. The protocol does not change: `on` still lists every cell read, and the guide and the schema's description say which of them get arrows.

Rejected:

- **Arcs outside the cells.** In a full table, such as matrix-chain's, the space beside a row is the next row, so an arc crosses other cells instead. Only an arc beyond the whole table would stay clear, and that is too long to follow.
- **Lines along the gutters.** The gap between cells is 4 units, too narrow for a line and an arrowhead to read as anything but a border.
- **Wider gaps in tables with arrows.** Every table's layout would change, and tables would no longer share the size that ADR 0008 measures over the trace.

### A label keeps clear of badges first

A point's label takes the first direction, in the order ADR 0038 gives, that is clear of everything near it. When no direction is clear of everything, it avoids, in this order:

1. the badges that any pointer puts under any point in some frame, since an opaque badge hides text;
2. other points and the labels placed before it;
3. lines: segments, sweep lines and axes, which only cross text.

Among the directions that pass the first two, it takes the one clearest of lines. Each point's badge region is exact: as many rows as it ever holds at once, and as wide as its widest pointer name.

## Consequences

- No arrow in a table crosses a cell other than the two it joins, and a property test checks it on random tables. The figures of rod cutting, matrix-chain multiplication, optimal BST, knapsack, Floyd–Warshall and every other table with distant dependencies lose those arrows, and keep the marks on the cells read.
- No point's label goes under a badge unless every direction meets one, and a property test checks that on random planes too. Labels of crowded planes may cross a line where they used to sit under a badge.
- The roles of the cells read (`compare`) and of the cell computed (`highlight`) carry the dependency where no arrow is drawn, together with the step's narration.
