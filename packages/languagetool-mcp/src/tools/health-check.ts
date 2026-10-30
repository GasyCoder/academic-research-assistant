import type { McpServer } from '@modelcontextprotocol/server';

import { LanguageToolError } from '../errors.js';
import type { LanguageToolClient } from '../languagetool-client.js';
import { toSoftwareInfo } from '../transform.js';
import { type HealthCheckResult, type SoftwareInfo, healthCheckResultSchema } from '../types.js';
import { toolSuccess } from './results.js';

/**
 * Probes /v2/healthcheck, then reads the version from /v2/info on a best-effort basis.
 * An offline server is a valid diagnosis, not a failure: it is reported in the result.
 */
export async function runHealthCheck(client: LanguageToolClient): Promise<HealthCheckResult> {
  try {
    await client.healthcheck();
  } catch (error) {
    if (!(error instanceof LanguageToolError)) {
      throw error;
    }
    const reachable = error.code === 'HTTP_ERROR' || error.code === 'INVALID_RESPONSE';
    return {
      status: reachable ? 'unhealthy' : 'unavailable',
      reachable,
      baseUrl: client.baseUrl,
      software: null,
      error: error.toDetails(),
    };
  }

  let software: SoftwareInfo | null = null;
  try {
    software = toSoftwareInfo((await client.getInfo()).software);
  } catch (error) {
    // Older servers may not expose /v2/info; the version is optional.
    if (!(error instanceof LanguageToolError)) {
      throw error;
    }
  }

  return { status: 'ok', reachable: true, baseUrl: client.baseUrl, software, error: null };
}

export function registerHealthCheckTool(server: McpServer, client: LanguageToolClient): void {
  server.registerTool(
    'health_check',
    {
      title: 'LanguageTool health check',
      description:
        'Check whether the configured LanguageTool server is reachable and report its version. ' +
        'Sends no text. Never fails when LanguageTool is offline: inspect `status`, `reachable` and `error`.',
      outputSchema: healthCheckResultSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    },
    async () => toolSuccess(await runHealthCheck(client)),
  );
}
