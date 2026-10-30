import type { CallToolResult } from '@modelcontextprotocol/server';

import { LanguageToolError } from '../errors.js';
import type { ToolError } from '../types.js';

export function toToolError(error: unknown): ToolError {
  if (error instanceof LanguageToolError) {
    return error.toDetails();
  }
  return {
    code: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : 'Unexpected error',
    endpoint: null,
    httpStatus: null,
  };
}

/** Successful result: structured content plus its JSON text for clients without structured output support. */
export function toolSuccess(data: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
    structuredContent: data,
  };
}

/**
 * Error result the calling model can act on. The error is serialized as JSON text;
 * structuredContent is omitted because it would not match the tool's output schema.
 */
export function toolFailure(error: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: toToolError(error) }) }],
    isError: true,
  };
}
