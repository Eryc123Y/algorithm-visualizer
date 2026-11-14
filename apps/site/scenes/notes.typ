// A page of a student's notes with an algomotion figure, compiled by
// `npm run scenes -w @algomotion/site` for the site's real scenes.
#import "@local/algomotion:0.1.0": algomotion

#set page(width: 15cm, height: auto, margin: (x: 1.5cm, y: 1.25cm))
#set text(size: 10.5pt)
#set heading(numbering: "1.")
#set par(justify: true)

= Shortest paths

Dijkstra's algorithm keeps a queue $Q$ of the vertices whose distance is
not yet final. Each round it takes the vertex with the least distance,
which is then final, and relaxes the edges that leave it.

#figure(
  algomotion("dijkstra", "A-B 4, B-C 1, A-C 7, C-D 2", step: "improve#3"),
  caption: [Step `improve#3`: C improves from 7 to 5, through B.],
)

The direct edge from $A$ to $C$ is on no shortest path: once $B$ is final
at 4, going through it costs $4 + 1 = 5 < 7$.
