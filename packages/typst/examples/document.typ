// A document, here written by `algoviz run`, in three themes.
#import "@local/algoviz:0.1.0": algoviz

#set page(width: 16cm, height: auto, margin: 1cm)

#let heap = json("heap.json")

#algoviz(heap, step: "pop/swap#1", width: 60%)

// One function with other defaults.
#let print-figure = algoviz.with(theme: "print", width: 60%)
#print-figure(heap, step: "push-0/swap#2")

// The dark theme has no background: put it on a dark page or block.
#block(fill: rgb("#14201c"), inset: 8pt, radius: 4pt, algoviz(
  heap,
  step: 0,
  theme: "dark",
  width: 60%,
))
