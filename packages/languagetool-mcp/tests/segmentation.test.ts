import { describe, expect, it } from 'vitest';

import { type Segment, type SegmentationOptions, segmentDocument } from '../src/segmentation.js';

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/** Positions where the text is cut: request edges and core edges. */
function cuts(segments: Segment[]): number[] {
  return segments.flatMap((segment) => [segment.start, segment.end, segment.coreStart, segment.coreEnd]);
}

function expectInvariants(text: string, segments: Segment[], options: SegmentationOptions): void {
  expect(segments[0]!.coreStart).toBe(0);
  expect(segments.at(-1)!.coreEnd).toBe(text.length);
  segments.forEach((segment, index) => {
    expect(segment.index).toBe(index);
    expect(segment.start).toBeLessThanOrEqual(segment.coreStart);
    expect(segment.coreEnd).toBeLessThanOrEqual(segment.end);
    expect(segment.end - segment.start).toBeLessThanOrEqual(options.maxRequestLength);
    expect(segment.coreStart - segment.start).toBeLessThanOrEqual(options.contextLength);
    expect(segment.end - segment.coreEnd).toBeLessThanOrEqual(options.contextLength);
    if (index > 0) {
      expect(segment.coreStart).toBe(segments[index - 1]!.coreEnd);
      expect(segment.coreStart).toBeGreaterThan(segments[index - 1]!.coreStart);
    }
  });
  for (const position of cuts(segments)) {
    if (position > 0 && position < text.length) {
      const before = text.charCodeAt(position - 1);
      const after = text.charCodeAt(position);
      expect(isHighSurrogate(before) && isLowSurrogate(after), `surrogate pair split at ${position}`).toBe(false);
      expect(before === 0x0d && after === 0x0a, `CRLF split at ${position}`).toBe(false);
    }
  }
}

describe('segmentDocument', () => {
  it('returns the whole document as one segment when it fits in one request', () => {
    const text = 'Short document.\n\nSecond paragraph.';
    expect(segmentDocument(text, { maxRequestLength: text.length, contextLength: 10 })).toEqual([
      { index: 0, start: 0, end: text.length, coreStart: 0, coreEnd: text.length },
    ]);
  });

  it('splits at the latest paragraph break, without context', () => {
    // Paragraphs of 30 characters plus a blank line: they start every 32 characters.
    const paragraphs = Array.from({ length: 10 }, (_, index) => `Paragraph ${index} has a few words.`.padEnd(30, '.'));
    const text = paragraphs.join('\n\n');
    const options = { maxRequestLength: 100, contextLength: 10 };
    const segments = segmentDocument(text, options);

    expectInvariants(text, segments, options);
    expect(segments.map((segment) => segment.coreStart)).toEqual([0, 64, 128, 192, 256]);
    for (const segment of segments) {
      expect(segment.start).toBe(segment.coreStart);
      expect(segment.end).toBe(segment.coreEnd);
    }
  });

  it('keeps CRLF paragraph breaks whole and adds no context there', () => {
    const text = Array.from({ length: 8 }, (_, index) => `Paragraph ${index} ends here.`).join('\r\n\r\n');
    const options = { maxRequestLength: 80, contextLength: 10 };
    const segments = segmentDocument(text, options);

    expectInvariants(text, segments, options);
    expect(segments.length).toBeGreaterThan(1);
    for (const segment of segments.slice(1)) {
      expect(text.slice(segment.coreStart - 4, segment.coreStart)).toBe('\r\n\r\n');
      expect(segment.start).toBe(segment.coreStart);
    }
  });

  it('prefers a line break to a sentence boundary inside a paragraph, and adds context there', () => {
    const text = Array.from({ length: 12 }, (_, index) => `Line ${index} has words. And more words`).join('\n');
    const options = { maxRequestLength: 200, contextLength: 40 };
    const segments = segmentDocument(text, options);

    expectInvariants(text, segments, options);
    for (const segment of segments.slice(1)) {
      expect(text[segment.coreStart - 1]).toBe('\n');
      expect(segment.start).toBeLessThan(segment.coreStart);
    }
    for (const segment of segments.slice(0, -1)) {
      expect(segment.end).toBeGreaterThan(segment.coreEnd);
    }
  });

  it('splits a very long paragraph at sentence boundaries, with whole sentences as context', () => {
    // Sentences of 29 characters: boundaries at 29, 58, 87, 116, 145...
    const text = Array.from({ length: 20 }, (_, index) => `Sentence number ${String(index).padStart(3, '0')} is here. `)
      .join('')
      .trimEnd();
    const options = { maxRequestLength: 200, contextLength: 40 };
    const segments = segmentDocument(text, options, 'en');

    expectInvariants(text, segments, options);
    // Core limit 120: the latest sentence start within it is 116; contexts hold the whole sentences that fit in 40.
    expect(segments[0]).toEqual({ index: 0, start: 0, end: 145, coreStart: 0, coreEnd: 116 });
    expect(segments[1]).toMatchObject({ start: 87, coreStart: 116 });
  });

  it('falls back to whitespace when no sentence boundary is in reach', () => {
    const text = 'word '.repeat(100).trimEnd();
    const options = { maxRequestLength: 200, contextLength: 40 };
    const segments = segmentDocument(text, options);

    expectInvariants(text, segments, options);
    expect(segments[0]).toEqual({ index: 0, start: 0, end: 160, coreStart: 0, coreEnd: 120 });
    expect(segments[1]).toMatchObject({ start: 80, coreStart: 120 });
  });

  it('hard-splits text without any whitespace', () => {
    const text = 'abcdefghij'.repeat(50);
    const options = { maxRequestLength: 200, contextLength: 40 };
    const segments = segmentDocument(text, options);

    expectInvariants(text, segments, options);
    expect(segments.map((segment) => segment.coreStart)).toEqual([0, 120, 240, 360, 480]);
  });

  it('never splits a surrogate pair at an odd cut position', () => {
    const text = '😀'.repeat(250);
    const options = { maxRequestLength: 201, contextLength: 41 };
    const segments = segmentDocument(text, options);

    expectInvariants(text, segments, options);
    expect(cuts(segments).every((position) => position % 2 === 0)).toBe(true);
  });

  it('never splits an emoji ZWJ sequence', () => {
    const family = '👩‍👩‍👧';
    expect(family).toHaveLength(8);
    const text = family.repeat(60);
    const options = { maxRequestLength: 201, contextLength: 41 };
    const segments = segmentDocument(text, options);

    expectInvariants(text, segments, options);
    expect(cuts(segments).every((position) => position % family.length === 0)).toBe(true);
  });

  it('does not cut between CR and LF when the limit falls between them', () => {
    const text = `${'x'.repeat(119)}\r\n${'y'.repeat(300)}`;
    const options = { maxRequestLength: 200, contextLength: 40 };
    const segments = segmentDocument(text, options);

    expectInvariants(text, segments, options);
    expect(cuts(segments)).not.toContain(120);
  });

  it('accepts "auto" and language codes that Intl does not support', () => {
    const text = 'One sentence. Another sentence. '.repeat(20);
    const options = { maxRequestLength: 100, contextLength: 20 };
    for (const locale of ['auto', 'en-x', 'zz-ZZZZZZZZ', undefined]) {
      expectInvariants(text, segmentDocument(text, options, locale), options);
    }
  });

  it('keeps every chunk within the request limit with the production values', () => {
    const paragraph = 'The proposed method improves the accuracy of the measurements. '.repeat(30).trim();
    const text = Array.from({ length: 80 }, () => paragraph).join('\n\n');
    const options = { maxRequestLength: 50_000, contextLength: 1_000 };
    const segments = segmentDocument(text, options, 'en-US');

    expectInvariants(text, segments, options);
    expect(text.length).toBeGreaterThan(150_000);
    expect(segments.length).toBe(4);
  });

  it('holds its invariants on random documents', () => {
    let seed = 42;
    const random = () => {
      // mulberry32
      seed = (seed + 0x6d2b79f5) | 0;
      let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]!;
    const pieces = ['word', 'mot', 'été', 'naïve', '😀', '👩‍👩‍👧', 'é', '𝔘𝔫𝔦', ' ', ' ', ' ', ' ', '. ', '? ', '\n', '\r\n', '\n\n', '\r\n\r\n', 'x'.repeat(40)];

    for (let run = 0; run < 300; run++) {
      let text = '';
      const length = Math.floor(random() * 3000);
      while (text.length < length) {
        text += pick(pieces);
      }
      const contextLength = Math.floor(random() * 30);
      const options = { maxRequestLength: 2 * contextLength + 2 + Math.floor(random() * 300), contextLength };
      expectInvariants(text, segmentDocument(text, options, pick(['en', 'fr', 'auto'])), options);
    }
  });
});
