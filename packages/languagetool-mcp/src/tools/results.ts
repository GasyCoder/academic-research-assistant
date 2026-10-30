import type { CallToolResult } from '@modelcontextprotocol/server';

import { LanguageToolError } from '../errors.js';
import type { ToolError } from '../types.js';

/** Budget for the full tool result, leaving room for the envelope below the SDK's 10 MiB stdio buffer. */
export const MAX_MCP_RESULT_BYTES = 8 * 1024 * 1024;

export function toToolError(error: unknown): ToolError {
  if (error instanceof LanguageToolError) {
    return error.toDetails();
  }
  // Unknown errors may carry external or user content in their message: it is never forwarded.
  return {
    code: 'INTERNAL_ERROR',
    message: 'Unexpected internal error',
    endpoint: null,
    httpStatus: null,
  };
}

/** Successful result: structured content plus its JSON text for clients without structured output support. */
export function toolSuccess(data: Record<string, unknown>): CallToolResult {
  const result: CallToolResult = {
    content: [{ type: 'text', text: JSON.stringify(data) }],
    structuredContent: data,
  };
  // The upstream HTTP limit does not cover normalization, the second copy, or JSON string escaping.
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > MAX_MCP_RESULT_BYTES) {
    return errorResult({
      code: 'INVALID_RESPONSE',
      message: `Tool result exceeds the ${MAX_MCP_RESULT_BYTES}-byte MCP result limit; request less data, e.g. check a shorter text`,
      endpoint: null,
      httpStatus: null,
    });
  }
  return result;
}

/**
 * Error result the calling model can act on. The error is serialized as JSON text;
 * structuredContent is omitted because it would not match the tool's output schema.
 */
export function toolFailure(error: unknown): CallToolResult {
  return errorResult(toToolError(error));
}

function errorResult(error: ToolError): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error }) }],
    isError: true,
  };
}
