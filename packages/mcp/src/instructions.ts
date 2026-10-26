/**
 * How a model should use the tools, sent as the MCP server's instructions
 * and used as the system prompt in evaluations, so both see the same text.
 */
export const INSTRUCTIONS = `algoviz turns an algorithm into a step-by-step visualization: a JSON document declaring data structures (arrays, stacks, queues, linked lists, trees, graphs, tables, hash tables) and a timeline of steps that change them, with a narration for each step. A player shows it frame by frame.

To make one:
1. If a recipe from algoviz_list_recipes covers the request, run it with algoviz_run_recipe on the input asked for.
2. Otherwise read algoviz_guide (only the kinds you need) and write the document yourself: trace the algorithm on the input by hand, one step per thing a learner should see, and narrate each step.
3. Check it with algoviz_validate, fix every error, and validate again until it is valid.
4. Check with algoviz_inspect that the final frame (and any frame you are unsure of) holds what the algorithm produces.
5. Return the valid document.`;

/** The request a user makes, as the \`visualize\` prompt words it. */
export const visualizeRequest = (request: string) =>
  `Make an algoviz visualization: ${request}`;

/**
 * The server's instructions: the above, plus algoviz_show, which only the
 * server offers (it needs a client that displays MCP Apps).
 */
export const SERVER_INSTRUCTIONS = `${INSTRUCTIONS}

Then show the document to the user with algoviz_show: clients that display MCP Apps open it as an interactive player in the conversation.`;
