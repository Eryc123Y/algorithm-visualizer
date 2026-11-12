/**
 * How a model should use the tools, sent as the MCP server's instructions
 * and used as the system prompt in evaluations, so both see the same text.
 */
export const INSTRUCTIONS = `algomotion turns an algorithm into a step-by-step visualization: a JSON document declaring data structures (arrays, stacks, queues, linked lists, trees, graphs, tables, hash tables) and a timeline of steps that change them, with a narration for each step. A player shows it frame by frame.

To make one:
1. If a recipe from algomotion_list_recipes covers the request, run it with algomotion_run_recipe on the input asked for, written short: a list "5 2 4 6 1 3", a graph "A-B 4, B-C 2" ("->" for directed edges), operations "insert 4, delete 3"; an input with one needed field may be that field alone, such as the graph for "dijkstra". For one operation on a data structure, use the operation's own recipe, such as "bst.delete" or "min-heap.pop", with \`from\` set to the starting structure: only the operation is animated. The structure's recipe without the operation, such as "bst", runs several operations one after another.
2. Otherwise read algomotion_guide (only the kinds you need) and write the document yourself: trace the algorithm on the input by hand, one step per thing a learner should see, and narrate each step.
3. Check it with algomotion_validate, fix every error, and validate again until it is valid.
4. Check with algomotion_inspect that the final frame (and any frame you are unsure of) holds what the algorithm produces.
5. Return the valid document.`;

/** The request a user makes, as the \`visualize\` prompt words it. */
export const visualizeRequest = (request: string) =>
  `Make an algomotion visualization: ${request}`;

/**
 * The server's instructions: the above, plus algomotion_show, which only the
 * server offers (it needs a client that displays MCP Apps).
 */
export const SERVER_INSTRUCTIONS = `${INSTRUCTIONS}

Then show the document to the user with algomotion_show: clients that display MCP Apps open it as an interactive player in the conversation. For a recipe, call algomotion_show with the recipe and its input instead of a document, such as { "recipe": "dijkstra", "input": "A-B 4, B-C 1, A-C 7" }, without running it first. When a result includes a share link, give it to the user too: it opens the visualization in the player in any browser, and in clients that cannot show the player it is the way to see it.`;
