// A document, here written by `algomotion run`, in three themes.
#import "@local/algomotion:0.1.0": algomotion

#set page(width: 16cm, height: auto, margin: 1cm)

#let heap = json("heap.json")

#algomotion(heap, step: "pop/swap#1", width: 60%)

// One function with other defaults.
#let print-figure = algomotion.with(theme: "print", width: 60%)
#print-figure(heap, step: "push-0/swap#2")

// The dark theme has no background: put it on a dark page or block.
#block(fill: rgb("#14201c"), inset: 8pt, radius: 4pt, algomotion(
  heap,
  step: 0,
  theme: "dark",
  width: 60%,
))
