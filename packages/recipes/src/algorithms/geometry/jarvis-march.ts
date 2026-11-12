/**
 * Jarvis's march (ADR 0038; CLRS 3rd edition, 33.3). From the lowest
 * point, the next hull vertex is the point with every other point on its
 * left: a candidate is kept, and any point to its right, or in line and
 * farther, takes its place. Wrapping walks the right chain and then the
 * left chain, back to the start.
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
  title: 'Jarvis’s march',
  topic: 'geometry',
  summary:
    'Finds the convex hull by wrapping: from the lowest point, each next vertex is the one with every other point on its left, found with cross products.',
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
              append c to H; p = c  // @wrap
          until p == p0
          return H  // @done
    `,
    python: `
      def jarvis_march(Q):
          p0 = min(Q, key=lambda p: (p.y, p.x))  # @p0
          hull, p = [p0], p0
          while True:
              c = next(r for r in Q if r is not p)  # @candidate
              for r in Q:
                  if r is not p and r is not c and beats(p, c, r):  # @better
                      c = r
              if c is p0:
                  return hull  # @done
              hull.append(c)  # @wrap
              p = c
    `,
  },
  run({ points }, trace) {
    const P = trace.add('P', planeOf(points));
    const p0 = lowest(points);
    trace.step(
      'p0',
      `Start at p0 = ${show(p0)}, the lowest point, the leftmost of the lowest: it is on the hull.`,
    );
    P.pointer({ name: 'p', point: p0.id }).settle({ point: p0.id });
    const hull: Pt[] = [p0];
    let at = p0;
    for (;;) {
      let c = points.find((q) => q !== at)!;
      const first = c;
      trace.step(
        'candidate',
        `From ${at.id}, take ${c.id} as the first candidate for the next vertex, and compare every other point with it.`,
      );
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
            ? `${r.id} is to the right of the line from ${at.id} to ${c.id} (cross product ${k}): it takes the candidate's place.`
            : `${r.id} is on the line from ${at.id} through ${c.id} and farther: it takes the candidate's place.`,
        );
        P.compare({ points: [at.id, c.id, r.id] }).pointer({
          name: 'c',
          point: r.id,
        });
        c = r;
      }
      const edge = `${at.id}-${c.id}`;
      if (c === p0) {
        trace.step(
          'done',
          `After ${compared} comparisons, every point is on the left of the line from ${at.id} to p0: the hull closes, with ${hull.length} vertices.`,
        );
        P.addSegment({ segment: { id: edge, from: at.id, to: c.id } })
          .select({ segment: edge, on: true })
          .pointer({ name: 'c', point: null })
          .pointer({ name: 'p', point: null });
        return { results: [hull.length] };
      }
      trace.step(
        'wrap',
        `After ${compared} comparisons, every point is on the left of the line from ${at.id} to ${c.id}: ${c.id} is the next hull vertex.`,
      );
      P.addSegment({ segment: { id: edge, from: at.id, to: c.id } })
        .select({ segment: edge, on: true })
        .settle({ point: c.id })
        .pointer({ name: 'p', point: c.id });
      hull.push(c);
      at = c;
    }
  },
});
