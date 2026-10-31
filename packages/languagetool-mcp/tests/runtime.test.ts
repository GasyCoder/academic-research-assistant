/*
 * Runtime capabilities check_document relies on. A Node.js build without ICU fails here with a
 * clear message rather than deep inside the segmentation tests. Locales are passed explicitly, so
 * the result does not depend on the system locale.
 */
import { describe, expect, it } from 'vitest';

describe('runtime', () => {
  it('provides Intl.Segmenter, which needs a Node.js build with ICU', () => {
    expect(process.versions.icu, 'Node.js was built without ICU').toBeDefined();
    expect(typeof Intl.Segmenter, 'Intl.Segmenter is missing').toBe('function');
  });

  it('segments sentences and grapheme clusters, including emoji sequences', () => {
    const sentences = new Intl.Segmenter('fr', { granularity: 'sentence' });
    expect(Array.from(sentences.segment('Une phrase. Une autre phrase.'), ({ segment }) => segment)).toEqual([
      'Une phrase. ',
      'Une autre phrase.',
    ]);
    const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' });
    const family = String.fromCodePoint(0x1f469, 0x200d, 0x1f469, 0x200d, 0x1f467);
    const flags = String.fromCodePoint(0x1f1eb, 0x1f1f7, 0x1f1f2, 0x1f1ec);
    expect(Array.from(graphemes.segment(`e${String.fromCodePoint(0x301)}${family}${flags}`))).toHaveLength(4);
  });
});
