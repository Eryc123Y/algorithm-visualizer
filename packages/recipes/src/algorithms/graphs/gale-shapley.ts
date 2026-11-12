/**
 * The Gale–Shapley algorithm for stable matching (CLRS 25.2). Each of n
 * proposers ranks the n receivers, and each receiver ranks the proposers.
 * While some proposer is free, the first free one proposes to the best
 * receiver it has not yet asked; a free receiver accepts, and an engaged
 * one keeps whichever of its partner and the new proposer it ranks higher.
 * The engagements at the end form a stable matching: no proposer and
 * receiver both prefer each other to their partners. Of all stable
 * matchings it is the best one for every proposer at once.
 *
 * The graph shows the two sides in columns and the engagements as marked
 * edges; tables P and R beside it hold the lists, P's asked receivers
 * settled.
 */
import { z } from 'zod';

import { defineAlgorithm } from '../../algorithm.ts';
import { NotationError, parseIn, quoted } from '../../notation/error.ts';

/** Most people on a side: lists of 8 still fit in a table. */
export const MAX_SIDE = 8;

const NAME = /^[A-Za-z0-9_.-]{1,8}$/;

const FORM =
  'each person with a colon and then their list, best first, e.g. "a: x y z, b: y x z, c: x z y"';

type Lists = [string, string[]][];

/** Reads `a: x y z, b: y x z`, throwing a NotationError at a bad token. */
export function parsePreferences(text: string): Lists {
  const out: Lists = [];
  for (const match of text.matchAll(/[^\s,]+/g)) {
    const token = match[0];
    const colon = token.indexOf(':');
    if (colon === 0 || (colon < 0 && out.length === 0))
      throw new NotationError(
        `Expected a name and a colon, such as "a:", ${colon === 0 ? 'not' : 'before'} ${quoted(token)}`,
        match.index,
      );
    if (colon < 0) out.at(-1)![1].push(token);
    else {
      const first = token.slice(colon + 1);
      out.push([token.slice(0, colon), first === '' ? [] : [first]]);
    }
  }
  return out;
}

const Name = z
  .string()
  .regex(NAME, 'A name is 1 to 8 letters, digits, "_", "." or "-"');

const Ranked = z
  .array(z.tuple([Name, z.array(Name)]))
  .min(1, 'Give at least one person on each side')
  .max(MAX_SIDE)
  .superRefine((lists, ctx) => {
    const seen = new Set<string>();
    lists.forEach(([name, list], k) => {
      if (seen.has(name))
        ctx.addIssue({
          code: 'custom',
          path: [k, 0],
          message: `${JSON.stringify(name)} appears twice; each person has one list`,
        });
      seen.add(name);
      const twice = list.find((x, i) => list.indexOf(x) !== i);
      if (twice !== undefined)
        ctx.addIssue({
          code: 'custom',
          path: [k, 1],
          message: `${name}'s list names ${JSON.stringify(twice)} twice`,
        });
    });
  });

/** A whole number as JavaScript orders object keys: before the others. */
const INDEX_LIKE = /^(0|[1-9]\d*)$/;

const Preferences = z
  .union([
    z
      .string()
      .transform((s, ctx) =>
        parseIn(s, ctx, parsePreferences, `Write ${FORM}.`),
      ),
    z
      .record(z.string(), z.array(z.string()))
      .superRefine((o, ctx) => {
        // JavaScript puts keys such as "1" first, so their order is lost.
        const index = Object.keys(o).find((k) => INDEX_LIKE.test(k));
        if (index !== undefined)
          ctx.addIssue({
            code: 'custom',
            path: [index],
            message: `An object puts a name such as ${JSON.stringify(index)} first, losing the order of the people; give the lists as text or as pairs instead`,
          });
      })
      .transform((o) => Object.entries(o)),
    z.array(z.tuple([z.string(), z.array(z.string())])),
  ])
  .pipe(Ranked);

/** Each list must rank the whole other side, once. */
function rankEachOther(
  { proposers, receivers }: { proposers: Lists; receivers: Lists },
  ctx: z.core.$RefinementCtx<unknown>,
) {
  if (proposers.length !== receivers.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['receivers'],
      message: `There must be as many receivers as proposers, not ${receivers.length} and ${proposers.length}`,
    });
    return;
  }
  const both = proposers.find(([p]) => receivers.some(([r]) => r === p));
  if (both !== undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['receivers'],
      message: `${JSON.stringify(both[0])} is on both sides; every name is on one side`,
    });
    return;
  }
  const check = (
    side: 'proposers' | 'receivers',
    mine: Lists,
    other: Lists,
  ) => {
    const names = other.map(([n]) => n);
    const what = side === 'proposers' ? 'receiver' : 'proposer';
    mine.forEach(([who, list], k) => {
      const stranger = list.find((x) => !names.includes(x));
      const missing = names.find((x) => !list.includes(x));
      if (stranger !== undefined)
        ctx.addIssue({
          code: 'custom',
          path: [side, k, 1],
          message: `${who}'s list names ${JSON.stringify(stranger)}, who is not a ${what}`,
        });
      else if (missing !== undefined)
        ctx.addIssue({
          code: 'custom',
          path: [side, k, 1],
          message: `${who}'s list does not rank ${missing}; each list ranks the whole other side`,
        });
    });
  };
  check('proposers', proposers, receivers);
  check('receivers', receivers, proposers);
}

const ORDINALS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
];

export const galeShapley = defineAlgorithm({
  id: 'gale-shapley',
  title: 'Gale–Shapley stable matching',
  topic: 'graphs',
  summary:
    'Matches n proposers with n receivers so that no two would both rather be with each other: each free proposer proposes down its list, and each receiver keeps the best proposal it has had.',
  input: z
    .strictObject({
      proposers: Preferences.describe(
        `Each proposer's ranking of the receivers, best first: ${FORM}, an object such as { "a": ["x", "y"] }, or pairs such as [["a", ["x", "y"]]]. At most ${MAX_SIDE}.`,
      ),
      receivers: Preferences.describe(
        "Each receiver's ranking of the proposers, best first, in the same forms.",
      ),
    })
    .superRefine(rankEachOther),
  examples: [
    {
      proposers: [
        ['a', ['x', 'y', 'z']],
        ['b', ['x', 'z', 'y']],
        ['c', ['y', 'x', 'z']],
      ],
      receivers: [
        ['x', ['c', 'b', 'a']],
        ['y', ['a', 'c', 'b']],
        ['z', ['b', 'a', 'c']],
      ],
    },
  ],
  code: {
    pseudocode: `
      GALE-SHAPLEY(P, R)  // each proposer ranks R, each receiver ranks P
          every proposer and every receiver starts free  // @start
          while some proposer p is free
              r = the first receiver on p's list that p has not proposed to  // @propose
              if r is free
                  r and p become engaged  // @accept
              elseif r ranks p above its partner p'
                  r and p become engaged, and p' is free again  // @trade
              else r rejects p, who stays free  // @reject
          return the engaged pairs  // @done
    `,
    python: `
      def gale_shapley(prefers, rank):
          # prefers[p] lists receivers best first; rank[r][p] is p's place on r's list
          partner = {}  # @start
          asked = {p: 0 for p in prefers}
          engaged = set()
          while len(engaged) < len(prefers):
              p = next(p for p in prefers if p not in engaged)
              r = prefers[p][asked[p]]  # @propose
              asked[p] += 1
              q = partner.get(r)
              if q is None:
                  partner[r] = p  # @accept
                  engaged.add(p)
              elif rank[r][p] < rank[r][q]:
                  partner[r] = p  # @trade
                  engaged.add(p)
                  engaged.discard(q)
              else:
                  continue  # @reject
          return partner  # @done
    `,
  },
  run(input, trace) {
    const { proposers, receivers } = input;
    const n = proposers.length;
    const prefers = new Map(proposers);
    const ranks = new Map(receivers);
    const columns = Array.from({ length: n }, (_, k) => String(k + 1));
    const graph = trace.add('g', {
      kind: 'graph',
      label: 'G',
      directed: false,
      layout: 'manual',
      nodes: [
        ...proposers.map(([p], k) => ({ id: p, x: 60, y: 40 + 60 * k })),
        ...receivers.map(([r], k) => ({ id: r, x: 260, y: 40 + 60 * k })),
      ],
      edges: [],
    });
    const table = (label: string, lists: Lists) =>
      trace.add(label, {
        kind: 'table',
        place: 'side',
        label: `${label}, ${label === 'P' ? 'proposers' : 'receivers'}’ lists`,
        initial: lists.map(([, list]) => [...list]),
        rowLabels: lists.map(([who]) => who),
        columnLabels: columns,
      });
    const P = table('P', proposers);
    const R = table('R', receivers);
    trace.step(
      'start',
      'Everyone starts free. Each proposer will propose down its list in P, and each receiver keeps the best proposal it has had, by its list in R.',
    );
    for (const [p] of proposers) graph.group({ node: p, group: 0 });
    for (const [r] of receivers) graph.group({ node: r, group: 1 });

    const asked = new Map(proposers.map(([p]) => [p, 0]));
    const partner = new Map<string, string>();
    const engaged = new Set<string>();
    let proposals = 0;
    let dropped: string[] = [];
    const edge = (p: string, r: string) => `${p}:${r}`;
    const row = (who: string, lists: Lists) =>
      lists.findIndex(([x]) => x === who);
    while (engaged.size < n) {
      const p = proposers.find(([x]) => !engaged.has(x))![0];
      const k = asked.get(p)!;
      const r = prefers.get(p)![k]!;
      asked.set(p, k + 1);
      proposals++;
      trace.step(
        'propose',
        `${p} is free and proposes to ${r}, the ${ORDINALS[k]} on its list.`,
      );
      for (const id of dropped) graph.removeEdge({ edge: id });
      dropped = [];
      graph
        .addEdge({ edge: { id: edge(p, r), from: p, to: r } })
        .pointer({ name: 'p', node: p })
        .highlight({ nodes: [p, r], edges: [edge(p, r)] });
      P.highlight({ cells: [[row(p, proposers), k]] }).settle({
        cells: [[row(p, proposers), k]],
      });

      const q = partner.get(r);
      const list = ranks.get(r)!;
      const rRow = row(r, receivers);
      if (q === undefined) {
        trace.step(
          'accept',
          `${r} is free, so it accepts ${p}: they are engaged.`,
        );
        partner.set(r, p);
        engaged.add(p);
        graph.markEdge({ edge: edge(p, r), mark: 'selected' });
        R.highlight({ cells: [[rRow, list.indexOf(p)]] });
        continue;
      }
      const [mine, theirs] = [list.indexOf(p), list.indexOf(q)];
      if (mine < theirs) {
        trace.step(
          'trade',
          `${r} ranks ${p} ${ORDINALS[mine]} and its partner ${q} ${ORDINALS[theirs]}: it leaves ${q}, who is free again, for ${p}.`,
        );
        partner.set(r, p);
        engaged.add(p);
        engaged.delete(q);
        graph
          .markEdge({ edge: edge(q, r), mark: 'rejected' })
          .markEdge({ edge: edge(p, r), mark: 'selected' });
        dropped = [edge(q, r)];
      } else {
        trace.step(
          'reject',
          `${r} ranks its partner ${q} ${ORDINALS[theirs]} and ${p} ${ORDINALS[mine]}: it rejects ${p}, who stays free.`,
        );
        graph.markEdge({ edge: edge(p, r), mark: 'rejected' });
        dropped = [edge(p, r)];
      }
      R.highlight({
        cells: [
          [rRow, mine],
          [rRow, theirs],
        ],
      });
    }
    trace.step(
      'done',
      `No proposer is free: the ${n === 1 ? 'engaged pair forms' : `${n} engaged pairs form`} a stable matching, the best one for every proposer, after ${proposals} proposal${proposals === 1 ? '' : 's'}.`,
    );
    for (const id of dropped) graph.removeEdge({ edge: id });
    graph.pointer({ name: 'p', node: null });
    return { results: [proposals] };
  },
});
