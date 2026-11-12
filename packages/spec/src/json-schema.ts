/**
 * JSON Schema for the authoring form, for LLM prompts, MCP tool definitions
 * and editor validation.
 */
import { z } from 'zod';

import { PROTOCOL_VERSION } from './version.ts';
import { VisualizationInput } from './visualization.ts';

export const SCHEMA_ID = `urn:algomotion:schema:visualization:${PROTOCOL_VERSION}`;

export function visualizationJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(VisualizationInput, { target: 'draft-2020-12' }),
    $id: SCHEMA_ID,
    title: 'Visualization',
  };
}
