// 一页带 algomotion 插图的学生笔记，由 `npm run scenes -w @algomotion/site`
// 编译成网站中文页面上的实景。
#import "@local/algomotion:1.0.0": algomotion

#set page(width: 15cm, height: auto, margin: (x: 1.5cm, y: 1.25cm))
#set text(size: 10.5pt, lang: "zh", font: ("Libertinus Serif", "Noto Serif CJK SC"))
#set heading(numbering: "1.")
#set par(justify: true)

= 最短路径

Dijkstra 算法用一个队列 $Q$ 存放距离尚未确定的顶点。每一轮取出距离最小的顶点，它的距离随即确定，然后松弛从它出发的边。

#figure(
  algomotion("dijkstra", "A-B 4, B-C 1, A-C 7, C-D 2", step: "improve#3"),
  caption: [第 `improve#3` 步：C 经由 B 从 7 改进为 5。],
)

从 $A$ 到 $C$ 的直接边不在任何最短路径上：$B$ 以 4 确定之后，经由 $B$ 到 $C$ 的代价是 $4 + 1 = 5 < 7$。
