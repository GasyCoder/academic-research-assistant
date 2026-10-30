import { describe, expect, it } from 'vitest';

import { LanguageToolError } from '../src/errors.js';
import { toSupportedLanguages } from '../src/transform.js';
import { emptyCheckResponse } from './fixtures/languagetool-responses.js';
import { createClient, jsonResponse, routeFetch } from './helpers.js';

function match(offset: number, length: number, context?: { text: string; offset: number; length: number }) {
  return { message: 'm', offset, length, replacements: [], ...(context && { context }), rule: { id: 'R' } };
}

async function check(text: string, matches: unknown[]) {
  const fetchMock = routeFetch({ 'POST /v2/check': () => jsonResponse({ ...emptyCheckResponse, matches }) });
  return createClient(fetchMock).check({ text, language: 'en' });
}

async function checkError(text: string, matches: unknown[]): Promise<LanguageToolError> {
  const error = await check(text, matches).then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(LanguageToolError);
  return error as LanguageToolError;
}

describe('issue ranges', () => {
  const text = 'This are a test.';

  it('accepts ranges inside the text, including one ending on its last character', async () => {
    const result = await check(text, [match(0, 4), match(15, 1), match(16, 0)]);
    expect(result.matches).toHaveLength(3);
  });

  it('rejects an offset far beyond the text', async () => {
    const error = await checkError(text, [match(0, 4), match(10_000, 1)]);
    expect(error.code).toBe('INVALID_RESPONSE');
    expect(error.message).toContain('matches.1');
    expect(error.message).toContain('outside the submitted text');
  });

  it('rejects a length overflowing the text', async () => {
    const error = await checkError(text, [match(12, 5)]);
    expect(error.code).toBe('INVALID_RESPONSE');
  });

  it('rejects negative values', async () => {
    expect((await checkError(text, [match(-1, 2)])).code).toBe('INVALID_RESPONSE');
    expect((await checkError(text, [match(1, -2)])).code).toBe('INVALID_RESPONSE');
  });

  it('rejects an incoherent context range', async () => {
    const error = await checkError(text, [match(0, 4, { text: 'This are', offset: 6, length: 4 })]);
    expect(error.code).toBe('INVALID_RESPONSE');
    expect(error.message).toContain('matches.0.context');
  });

  it('accepts a coherent context range', async () => {
    const result = await check(text, [match(5, 3, { text: 'This are a', offset: 5, length: 3 })]);
    expect(result.matches[0]?.context).toEqual({ text: 'This are a', offset: 5, length: 3 });
  });

  describe('with surrogate pairs', () => {
    // 3 emoji = 6 UTF-16 code units but 3 code points: text.length is 13, [...text].length is 10.
    const emojiText = '😀😀😀 Il ont';

    it('measures ranges in UTF-16 code units, like LanguageTool and JavaScript', async () => {
      expect(emojiText.length).toBe(13);
      expect([...emojiText]).toHaveLength(10);

      const result = await check(emojiText, [match(7, 6, { text: emojiText, offset: 7, length: 6 })]);
      expect(emojiText.slice(result.matches[0]!.offset, 13)).toBe('Il ont');
    });

    it('still rejects a range past the UTF-16 length', async () => {
      expect((await checkError(emojiText, [match(11, 3)])).code).toBe('INVALID_RESPONSE');
    });
  });
});

describe('variantsByCode with upstream-controlled keys', () => {
  const tricky = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'prototype'];

  it('keeps unusual language codes as plain data', () => {
    const result = toSupportedLanguages([
      ...tricky.map((code) => ({ name: `Lang ${code}`, code, longCode: `${code}-X` })),
      { name: 'English', code: 'en', longCode: 'en' },
    ]);

    for (const code of tricky) {
      expect(Object.hasOwn(result.variantsByCode, code)).toBe(true);
      expect(result.variantsByCode[code]).toEqual([`${code}-X`]);
    }
    expect(result.variantsByCode.en).toEqual(['en']);
    expect(Object.keys(result.variantsByCode)).toEqual([...tricky, 'en']);
    expect(JSON.parse(JSON.stringify(result.variantsByCode)).__proto__).toEqual(['__proto__-X']);
  });

  it('does not pollute Object.prototype', () => {
    toSupportedLanguages([{ name: 'x', code: '__proto__', longCode: 'polluted' }]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
  });
});
