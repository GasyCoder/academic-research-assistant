import { describe, expect, it } from 'vitest';

import { type Segment, type SegmentationOptions, graphemeBoundaryPositions, segmentDocument } from '../src/segmentation.js';

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/** Positions where the text is cut: request edges and core edges. */
function cuts(segments: Segment[]): number[] {
  return segments.flatMap((segment) => [segment.start, segment.end, segment.coreStart, segment.coreEnd]);
}

/**
 * Global grapheme boundaries of `unit` repeated up to `length` code units. They are periodic, so one
 * Intl.Segmenter pass over a few repetitions gives them, up to the last full repetition; a pass over
 * the whole text would take seconds on Node 20. The end is segmented for real from there, since a
 * repetition cut short can end with a lone surrogate that starts a cluster of its own.
 */
function periodicGraphemeBoundaries(unit: string, length: number): Set<number> {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const sample = Array.from(segmenter.segment(unit.repeat(4)), ({ index }) => index);
  const period = (copy: number) =>
    sample.filter((index) => index >= copy * unit.length && index < (copy + 1) * unit.length).map((index) => index - copy * unit.length);
  expect(period(0)).toEqual(period(1));
  expect(period(2)).toEqual(period(1));
  expect(period(1)[0]).toBe(0);
  const text = unit.repeat(Math.ceil(length / unit.length)).slice(0, length);
  const tailStart = Math.max(0, (Math.floor(length / unit.length) - 1) * unit.length);
  const boundaries = new Set([length]);
  for (let base = 0; base < tailStart; base += unit.length) {
    for (const offset of period(1)) {
      boundaries.add(base + offset);
    }
  }
  for (const { index } of segmenter.segment(text.slice(tailStart))) {
    boundaries.add(tailStart + index);
  }
  return boundaries;
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

  it.each(['🇫🇷🇲🇬🇩🇪', '👩‍👩‍👧‍👦', '👍🏽', '✈️', 'e\u0301', 'a \u0301'])(
    'keeps all request and core edges on global grapheme boundaries: %s',
    (unit) => {
      const text = unit.repeat(Math.ceil(100_000 / unit.length)).slice(0, 100_000);
      const boundaries = periodicGraphemeBoundaries(unit, text.length);
      for (const options of [
        { maxRequestLength: 50_000, contextLength: 1_000 },
        { maxRequestLength: 2_003, contextLength: 101 },
      ]) {
        const segments = segmentDocument(text, options);
        expectInvariants(text, segments, options);
        expect(cuts(segments).filter((position) => !boundaries.has(position))).toEqual([]);
        expect(segments.map((segment) => text.slice(segment.coreStart, segment.coreEnd)).join('')).toBe(text);
      }
    },
  );

  it('segments a document at the limit in linear time on every supported runtime', () => {
    // One grapheme per code unit is the worst case. Node 20's Intl.Segmenter costs time proportional
    // to the input on every segment: one pass over such a text took over 10 s there.
    const paragraphs = Array.from({ length: 1_800 }, (_, index) => `Paragraph ${index} describes the method in detail.`);
    for (const text of ['x'.repeat(100_000), paragraphs.join('\n\n').slice(0, 100_000)]) {
      const start = performance.now();
      segmentDocument(text, { maxRequestLength: 50_000, contextLength: 1_000 }, 'en-US');
      expect(performance.now() - start).toBeLessThan(2_000);
    }
  });

  it('makes progress when one grapheme exceeds the entire request budget', () => {
    const text = `a${'\u0301'.repeat(60_000)}${'x'.repeat(39_999)}`;
    const options = { maxRequestLength: 50_000, contextLength: 1_000 };
    const segments = segmentDocument(text, options);
    expectInvariants(text, segments, options);
    expect(segments.every((segment) => segment.coreEnd > segment.coreStart)).toBe(true);
    expect(segments.map((segment) => text.slice(segment.coreStart, segment.coreEnd)).join('')).toBe(text);
  });

  it.each([49_999, 50_000, 50_001, 95_999, 96_000, 96_001, 99_999, 100_000])(
    'bounds every request for a whitespace-free document of %i UTF-16 units',
    (length) => {
      const text = 'x'.repeat(length);
      const options = { maxRequestLength: 50_000, contextLength: 1_000 };
      const segments = segmentDocument(text, options);
      expectInvariants(text, segments, options);
      expect(segments.every((segment) => segment.end > segment.start)).toBe(true);
      expect(segments.map((segment) => text.slice(segment.coreStart, segment.coreEnd)).join('')).toBe(text);
    },
  );

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

describe('graphemeBoundaryPositions', () => {
  const cp = (...codes: number[]) => String.fromCodePoint(...codes);
  // Units chosen for UAX #29 rules that look at more than two code points.
  const pieces = [
    'a', 'x', ' ', '.', '\r\n', '\n',
    cp(0x1f1eb), cp(0x1f1f7), // regional indicators, paired by parity
    cp(0x1f469, 0x200d, 0x1f469, 0x200d, 0x1f467), cp(0x200d), cp(0x1f44d, 0x1f3fd), cp(0x2708, 0xfe0f), // ZWJ, modifiers, VS16
    cp(0x301), cp(0x301).repeat(20), // combining marks, including runs longer than small windows
    cp(0x1100), cp(0x1161), cp(0x11a8), cp(0xac00), // Hangul L, V, T jamo and a syllable
    cp(0x915, 0x94d, 0x937), cp(0x94d), cp(0x903), // Indic conjunct, virama, spacing mark
    cp(0x600), // prepend
    String.fromCharCode(0xd83d), String.fromCharCode(0xdc4d), // lone surrogates, as in malformed input
  ];

  it.each([1, 2, 3, 7, 64, 1_024])('finds the same boundaries as one whole-text pass, in windows of %i units', (window) => {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    let seed = window;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    for (let run = 0; run < 200; run++) {
      let text = '';
      const length = Math.floor(random() * 400);
      while (text.length < length) {
        text += pieces[Math.floor(random() * pieces.length)];
      }
      const whole = Array.from(segmenter.segment(text), ({ index }) => index);
      whole.push(text.length);
      expect(graphemeBoundaryPositions(text, window)).toEqual(whole);
    }
  });
});
