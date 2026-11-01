/*
 * Optional local Vale adapter: style-guide and terminology lint of supplied text.
 *
 * The executable and configuration are fixed by the operator (ARA_VALE_PATH, ARA_VALE_CONFIG) and
 * must already exist: nothing is installed, discovered, synced or downloaded. The text goes through
 * stdin, never through arguments or temporary files. The process runs without a shell, with fixed
 * arguments, a minimal environment, a timeout and capped output. Results are Vale's own diagnostics,
 * separate from LanguageTool findings and from any academic judgement; nothing is rewritten.
 */
import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { dirname } from 'node:path';

import { z } from 'zod';

import { IntegrationError, LIMITS, errorSchema, parseInput, safeError, valeInputSchema } from './contracts.js';
import { redact, secretsOf, type Config } from './config.js';

const diagnosticSchema = z.object({
  Check: z.string().min(1).max(256),
  Message: z.string().max(2000),
  Severity: z.enum(['suggestion', 'warning', 'error']),
  Match: z.string().max(2000).optional(),
  Line: z.number().int().nonnegative(),
  Span: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
});
// Unknown keys (Action, Suggestions, Link, Description) are dropped by z.object.
const outputSchema = z.record(z.string(), z.array(diagnosticSchema));

export const valeResultSchema = z
  .object({
    engine: z.literal('vale'),
    sourceKind: z.literal('local_tool_result'),
    status: z.enum(['completed', 'unavailable']),
    diagnostics: z.array(diagnosticSchema.strict()).max(LIMITS.diagnostics),
    truncated: z.boolean(),
    checkedAt: z.string(),
    /** Vale's 1-based line and column span, not UTF-16 offsets of the submitted text. */
    coordinateSystem: z.literal('vale_line_span'),
    error: errorSchema.optional(),
  })
  .strict();
export type ValeResult = z.infer<typeof valeResultSchema>;

export async function checkVale(config: Config, input: unknown): Promise<ValeResult> {
  const { text, format } = parseInput(valeInputSchema, input);
  const checkedAt = new Date().toISOString();
  const base = { engine: 'vale', sourceKind: 'local_tool_result', checkedAt, coordinateSystem: 'vale_line_span' } as const;
  try {
    const { valePath, valeConfig } = config;
    if (!valePath || !valeConfig || !(await isFile(valePath)) || !(await isFile(valeConfig))) {
      throw new IntegrationError('VALE_UNAVAILABLE');
    }
    const args = ['--config', valeConfig, '--no-global', '--output=JSON', '--no-exit', format === 'markdown' ? '--ext=.md' : '--ext=.txt'];
    const output = await run(valePath, args, dirname(valeConfig), text, config.timeoutMs);
    let raw: unknown;
    try {
      raw = JSON.parse(output);
    } catch {
      throw new IntegrationError('INVALID_RESPONSE');
    }
    const parsed = outputSchema.safeParse(raw);
    if (!parsed.success) {
      throw new IntegrationError('INVALID_RESPONSE');
    }
    // The keys are Vale's names for the input ("stdin.md"...): dropped.
    const diagnostics = Object.values(parsed.data).flat();
    if (diagnostics.some((d) => d.Span[1] < d.Span[0])) {
      throw new IntegrationError('INVALID_RESPONSE');
    }
    const secrets = secretsOf(config);
    return {
      ...base,
      status: 'completed',
      // Rule names, messages and matches are free-form; Severity, Line and Span stay intact.
      diagnostics: diagnostics.slice(0, LIMITS.diagnostics).map((d) => ({
        ...d,
        Check: redact(d.Check, secrets),
        Message: redact(d.Message, secrets),
        ...(d.Match === undefined ? {} : { Match: redact(d.Match, secrets) }),
      })),
      truncated: diagnostics.length > LIMITS.diagnostics,
    };
  } catch (error) {
    return { ...base, status: 'unavailable', diagnostics: [], truncated: false, error: safeError(error).details() };
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** Runs the fixed executable; resolves with stdout, rejects with a fixed IntegrationError. */
function run(executable: string, args: string[], cwd: string, stdin: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let done = false;
    let size = 0;
    const chunks: Buffer[] = [];
    const child = spawn(executable, args, {
      shell: false,
      cwd,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      // Provider credentials and the rest of the user environment never reach the linter.
      env: {
        PATH: process.env.PATH ?? '',
        ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
        LANG: 'C.UTF-8',
      },
    });
    const finish = (error?: IntegrationError): void => {
      if (done) {
        return;
      }
      done = true;
      clearTimeout(timer);
      if (error) {
        child.kill('SIGKILL');
        reject(error);
      } else {
        resolve(Buffer.concat(chunks).toString('utf8'));
      }
    };
    const timer = setTimeout(() => finish(new IntegrationError('TIMEOUT')), timeoutMs);
    // stderr is counted against the cap but never kept: it may quote the text or local paths.
    const capture = (chunk: Buffer, keep: boolean): void => {
      if (done) {
        return;
      }
      size += chunk.byteLength;
      if (size > LIMITS.processBytes) {
        finish(new IntegrationError('RESPONSE_TOO_LARGE'));
      } else if (keep) {
        chunks.push(chunk);
      }
    };
    child.stdout.on('data', (chunk: Buffer) => capture(chunk, true));
    child.stderr.on('data', (chunk: Buffer) => capture(chunk, false));
    child.once('error', (error: NodeJS.ErrnoException) =>
      finish(new IntegrationError(error.code === 'ENOENT' || error.code === 'EACCES' ? 'VALE_UNAVAILABLE' : 'VALE_FAILURE')),
    );
    // With --no-exit, alerts exit 0; 2 means Vale could not run (bad config, rule or input).
    child.once('close', (code) => finish(code === 0 ? undefined : new IntegrationError('VALE_FAILURE')));
    // An early exit makes stdin emit EPIPE: it must not become an uncaught exception.
    child.stdin.on('error', () => {});
    child.stdin.end(stdin);
  });
}
