import { describe, expect, it } from 'vitest';

import { MAX_MCP_RESULT_BYTES, toolSuccess } from '../src/tools/results.js';
import { toolErrorSchema } from '../src/types.js';

describe('MCP result size limit', () => {
  it.each([
    ['both representations', 'a'.repeat(5 * 1024 * 1024)],
    ['UTF-8 bytes', 'é'.repeat(2_200_000)],
    ['JSON escaping in text content', '"'.repeat(1_500_000)],
  ])('bounds %s without echoing the rejected data', (_case, padding) => {
    const marker = 'UNPUBLISHED-RESULT-819';
    const data = { value: marker + padding };
    const unbounded = { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data };
    expect(Buffer.byteLength(JSON.stringify(data))).toBeLessThan(MAX_MCP_RESULT_BYTES);
    expect(Buffer.byteLength(JSON.stringify(unbounded))).toBeGreaterThan(MAX_MCP_RESULT_BYTES);

    const result = toolSuccess(data);
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain(marker);
    const error = JSON.parse((result.content[0] as { text: string }).text).error;
    expect(toolErrorSchema.safeParse(error).success).toBe(true);
    expect(error).toEqual({
      code: 'INVALID_RESPONSE',
      message: `Tool result exceeds the ${MAX_MCP_RESULT_BYTES}-byte MCP result limit; request less data, e.g. check a shorter text`,
      endpoint: null,
      httpStatus: null,
    });
  });

  it('accepts the complete result at the byte limit and rejects the next larger result', () => {
    const empty = { content: [{ type: 'text', text: JSON.stringify({ value: '' }) }], structuredContent: { value: '' } };
    const overhead = Buffer.byteLength(JSON.stringify(empty));
    const padding = 'a'.repeat(Math.floor((MAX_MCP_RESULT_BYTES - overhead) / 2));
    const data = { value: padding };
    const result = toolSuccess(data);
    expect(Buffer.byteLength(JSON.stringify(result))).toBe(MAX_MCP_RESULT_BYTES);
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual(data);
    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual(data);
    expect(toolSuccess({ value: padding + 'a' }).isError).toBe(true);
  });
});
