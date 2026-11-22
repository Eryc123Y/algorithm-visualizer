/**
 * Jarvis's march (ADR 0038; CLRS 3rd edition, 33.3). From the lowest
 * point, the next hull vertex is the point with every other point on its
 * left: a candidate is kept, and any point to its right, or in line and
 * farther, takes its place. The wrap goes counterclockwise, back to the
 * start; CLRS's right and left chains are its two halves.
 */
import { defineAlgorithm } from '../../algorithm.ts';
import { cross, dist2, lowest, planeOf, show, type Pt } from './common.ts';
import { parsePoints } from './common.ts';
import { hullInput } from './graham-scan.ts';

/** Whether `p` beats the candidate `c` as the next vertex after `at`. */
export function beats(at: Pt, c: Pt, p: Pt): boolean {
  const k = cross(at, c, p);
  return k < 0 || (k === 0 && dist2(at, p) > dist2(at, c));
}

export const jarvisMarch = defineAlgorithm({
  id: 'jarvis-march',
  title: { en: 'Jarvis’s march', zh: 'Jarvis 步进法' },
  topic: 'geometry',
  summary: {
    en: 'Finds the convex hull by wrapping: from the lowest point, each next vertex is the one with every other point on its left, found with cross products.',
    zh: '用包裹的方法求凸包：从最低的点出发，下一个顶点是使其他所有点都在它左边的那个点，用叉积找到。',
  },
  input: hullInput,
  main: 'points',
  examples: [
    {
      points: parsePoints(
        '(0, 0) (4, 1) (6, 4) (3, 6) (-1, 4) (2, 2) (3, 3) (1, 4)',
      ),
    },
    { points: parsePoints('(0, 0) (2, 0) (4, 0) (4, 4) (2, 2) (0, 4)') },
  ],
  code: {
    pseudocode: `
      JARVIS-MARCH(Q)
          p0 = the point of Q with the least y, the leftmost of those  // @p0
          H = (p0)
          p = p0
          repeat
              c = a point of Q other than p  // @candidate
              for each point r of Q other than p and c
                  if r is right of the line from p to c, or on it and farther  // @better
                      c = r
              p = c
              if p ≠ p0
                  append p to H  // @wrap
          until p == p0
          return H  // @done
    `,
    python: `
      def jarvis_march(Q):
          p0 = min(Q, key=lambda p: (p.y, p.x))  # @p0
          hull, p = [p0], p0
          while True:
              c = first = next(r for r in Q if r is not p)  # @candidate
              for r in Q:
                  if r is not p and r is not first and beats(p, c, r):  # @better
                      c = r
              if c is p0:
                  return hull  # @done
              hull.append(c)  # @wrap
              p = c
    `,
  },
  run({ points }, trace) {
    const P = trace.add(
      'P',
      planeOf(points, [], trace.say({ en: 'points', zh: '点' })),
    );
    const p0 = lowest(points);
    trace.step('p0', {
      en: `Start at p0 = ${show(p0)}, the lowest point, the leftmost of the lowest: it is on the hull.`,
      zh: `从 p0 = ${show(p0)} 开始，它是最低的点，最低的点中最左边的那个：它在凸包上。`,
    });
    P.pointer({ name: 'p', point: p0.id }).settle({ point: p0.id });
    const hull: Pt[] = [p0];
    let at = p0;
    for (;;) {
      let c = points.find((q) => q !== at)!;
      const first = c;
      trace.step('candidate', {
        en: `From ${at.id}, take ${c.id} as the first candidate for the next vertex, and compare every other point with it.`,
        zh: `从 ${at.id} 出发，先把 ${c.id} 作为下一个顶点的候选，再拿其他每个点和它比较。`,
      });
      P.pointer({ name: 'c', point: c.id }).highlight({ points: [c.id] });
      let compared = 0;
      for (const r of points) {
        if (r === at || r === first) continue;
        compared++;
        if (!beats(at, c, r)) continue;
        const k = cross(at, c, r);
        trace.step(
          'better',
          k < 0
            ? {
                en: `${r.id} is to the right of the line from ${at.id} to ${c.id} (cross product ${k}): it takes the candidate's place.`,
                zh: `${r.id} 在从 ${at.id} 到 ${c.id} 的直线右边（叉积为 ${k}）：它取代候选点。`,
              }
            : {
                en: `${r.id} is on the line from ${at.id} through ${c.id} and farther: it takes the candidate's place.`,
                zh: `${r.id} 在从 ${at.id} 经过 ${c.id} 的直线上，而且更远：它取代候选点。`,
              },
        );
        P.compare({ points: [at.id, c.id, r.id] }).pointer({
          name: 'c',
          point: r.id,
        });
        c = r;
      }
      const edge = `${at.id}-${c.id}`;
      if (c === p0) {
        trace.step('done', {
          en: `After ${compared} comparisons, every point is on the left of the line from ${at.id} to p0: the hull closes, with ${hull.length} vertices.`,
          zh: `比较 ${compared} 次之后，每个点都在从 ${at.id} 到 p0 的直线左边：凸包闭合，共 ${hull.length} 个顶点。`,
        });
        P.addSegment({ segment: { id: edge, from: at.id, to: c.id } })
          .select({ segment: edge, on: true })
          .pointer({ name: 'c', point: null })
          .pointer({ name: 'p', point: null });
        return { results: [hull.length] };
      }
      trace.step('wrap', {
        en: `After ${compared} comparisons, every point is on the left of the line from ${at.id} to ${c.id}: ${c.id} is the next hull vertex.`,
        zh: `比较 ${compared} 次之后，每个点都在从 ${at.id} 到 ${c.id} 的直线左边：${c.id} 是凸包的下一个顶点。`,
      });
      P.addSegment({ segment: { id: edge, from: at.id, to: c.id } })
        .select({ segment: edge, on: true })
        .settle({ point: c.id })
        .pointer({ name: 'p', point: c.id });
      hull.push(c);
      at = c;
    }
  },
});
