/*
 * Deterministic stand-in for LanguageTool's /v2/check, so that document offsets can
 * be predicted: every "teh" is a spelling issue. Markers in the checked text trigger
 * specific behaviours (see fakeLanguageToolFetch).
 */
import type { FetchLike } from '../src/languagetool-client.js';
import { connectionRefused, jsonResponse, textResponse } from './helpers.js';

export interface FakeCheckOptions {
  /** Length of every issue message, to inflate results. */
  messageLength?: number;
}

function fakeMatch(text: string, offset: number, length: number, ruleId: string, replacements: string[], message: string) {
  const contextStart = Math.max(0, offset - 20);
  return {
    message,
    shortMessage: 'Spelling mistake',
    offset,
    length,
    replacements: replacements.map((value) => ({ value })),
    context: { text: text.slice(contextStart, offset + length + 20), offset: offset - contextStart, length },
    sentence: text.slice(contextStart, offset + length + 20),
    rule: {
      id: ruleId,
      description: 'Fake rule',
      issueType: 'misspelling',
      category: { id: 'TYPOS', name: 'Possible Typo' },
    },
  };
}

/** A /v2/check answer for `text`: "teh" is misspelt, "DOUBLE" has two rules at one offset, "MANYREPS" 12 replacements. */
export function fakeCheckResponse(text: string, language = 'en-US', options: FakeCheckOptions = {}) {
  const message = options.messageLength ? 'm'.repeat(options.messageLength) : 'Possible spelling mistake found.';
  const matches = [
    ...Array.from(text.matchAll(/teh/g), (match) => fakeMatch(text, match.index, 3, 'FAKE_SPELLING', ['the'], message)),
    ...Array.from(text.matchAll(/DOUBLE/g), (match) => [
      fakeMatch(text, match.index, 6, 'FAKE_RULE_A', ['double'], message),
      fakeMatch(text, match.index, 6, 'FAKE_RULE_B', ['Double'], message),
    ]).flat(),
    ...Array.from(text.matchAll(/MANYREPS/g), (match) =>
      fakeMatch(text, match.index, 8, 'FAKE_SPELLING', Array.from({ length: 12 }, (_, index) => `rep${index}`), message),
    ),
  ].sort((a, b) => a.offset - b.offset);
  return {
    software: { name: 'LanguageTool', version: '6.9-SNAPSHOT', apiVersion: 1 },
    warnings: { incompleteResults: false },
    language: { name: language === 'fr' ? 'French' : 'English (US)', code: language === 'auto' ? 'en-US' : language },
    matches,
  };
}

/**
 * A fetch serving /v2/check with fakeCheckResponse. Markers in the checked text:
 * HANG never answers (until the client times out), FAIL500 answers HTTP 500,
 * BADJSON answers invalid JSON, REFUSED fails like a refused connection.
 */
export function fakeLanguageToolFetch(options: FakeCheckOptions & { delayMs?: number } = {}) {
  const state = { requests: [] as URLSearchParams[], inFlight: 0, maxInFlight: 0 };
  const fetch: FetchLike = async (_input, init) => {
    const params = init.body as URLSearchParams;
    const text = params.get('text') ?? '';
    state.requests.push(params);
    state.inFlight++;
    state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
    try {
      if (options.delayMs !== undefined) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }
      if (text.includes('HANG')) {
        return await new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        });
      }
      if (text.includes('REFUSED')) {
        throw connectionRefused();
      }
      if (text.includes('FAIL500')) {
        return textResponse(`Internal error while checking: ${text}`, 500);
      }
      if (text.includes('BADJSON')) {
        return textResponse(`{"echo": "${text}"`);
      }
      return jsonResponse(fakeCheckResponse(text, params.get('language') ?? 'en-US', options));
    } finally {
      state.inFlight--;
    }
  };
  return { fetch, state, texts: () => state.requests.map((params) => params.get('text') ?? '') };
}

/** Offsets of every "teh" in `text`: the issues the fake reports, in document coordinates. */
export function tehOffsets(text: string): number[] {
  return Array.from(text.matchAll(/teh/g), (match) => match.index);
}
