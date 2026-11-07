// Several steps of one run on one scale, with their selectors as captions.
#import "@local/algoviz:0.1.0": algoviz-figures, algoviz-series

#set page(width: 18cm, height: auto, margin: 1cm)

#let input = (from: (8, 3, 10, 1, 6), key: 3)

// Every frame, in a grid: one canvas per document, so one scale.
#grid(
  columns: 3,
  gutter: 8pt,
  ..algoviz-series("bst.delete", input, width: 100%),
)

// Chosen frames, with captions from the engine's data.
#let series = algoviz-figures("bst.delete", input, steps: (0, -1))
#grid(
  columns: 2,
  gutter: 8pt,
  ..series.figures.map(f => figure(
    image(bytes(f.svg), format: "svg", width: 100%),
    caption: raw(f.selector),
  )),
)
