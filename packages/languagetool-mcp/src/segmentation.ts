/*
 * Splits a long document into segments that each fit in one LanguageTool request.
 *
 * Every segment has a core and a request range. The cores partition the document:
 * a segment reports only the diagnostics that start in its core. Where a core edge
 * is an artificial cut (anything but a blank-line paragraph break), the request also
 * carries up to `contextLength` units of the neighbouring text, so that LanguageTool
 * sees whole sentences and paired brackets around the cut. Diagnostics found in that
 * context belong to the neighbouring segment, which sees them with its own context.
 *
 * All positions are UTF-16 code units, like LanguageTool offsets and JavaScript
 * string indices. No position ever falls inside a surrogate pair or a CRLF.
 */

export interface Segment {
  index: number;
  /** Range sent to LanguageTool, context included. */
  start: number;
  end: number;
  /** Range whose diagnostics this segment reports. */
  coreStart: number;
  coreEnd: number;
}

export interface SegmentationOptions {
  /** Longest range sent in one request, context included. */
  maxRequestLength: number;
  /** Context added on each side of an artificial cut. */
  contextLength: number;
}

/** Text given to Intl.Segmenter around a searched range, so that boundaries near its edges are accurate. */
const SEGMENTER_MARGIN = 200;

/** A blank line, possibly with spaces or CRs; it ends right after its last LF. */
const PARAGRAPH_BREAK = /\n[ \t\r]*\n/g;

/** Whitespace a text may be cut after. No-break spaces are excluded: they glue units such as "10 %". */
const BREAKABLE_SPACE = /[\t\n\v\f\r \u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]/;

interface Segmenters {
  sentence: Intl.Segmenter;
  graphemePositions: number[];
  graphemeBoundaries: Set<number>;
}

/**
 * Cuts are chosen, from best to worst: blank-line paragraph break, line break, sentence
 * boundary, whitespace, grapheme boundary. The latest cut of the best kind in the second
 * half of the allowed core length is used, so cores are never shorter than half of it
 * (except the last one).
 *
 * @param locale LanguageTool language code used for sentence boundaries; "auto" or an
 *   unsupported code falls back to the default rules.
 */
export function segmentDocument(text: string, options: SegmentationOptions, locale?: string): Segment[] {
  if (text.length <= options.maxRequestLength) {
    return [{ index: 0, start: 0, end: text.length, coreStart: 0, coreEnd: text.length }];
  }
  const maxCoreLength = options.maxRequestLength - 2 * options.contextLength;
  if (maxCoreLength < 2) {
    throw new RangeError('maxRequestLength must exceed twice contextLength by at least 2');
  }
  const segmenters = createSegmenters(text, locale);

  const cores: Array<{ start: number; end: number; natural: boolean }> = [];
  let start = 0;
  while (text.length - start > maxCoreLength) {
    const cut = findCut(text, start, start + maxCoreLength, segmenters);
    cores.push({ start, end: cut.position, natural: cut.natural });
    start = cut.position;
  }
  cores.push({ start, end: text.length, natural: true });

  return cores.map((core, index) => {
    const previous = cores[index - 1];
    return {
      index,
      start:
        previous === undefined || previous.natural
          ? core.start
          : leftContextStart(text, core.start, options.contextLength, segmenters),
      end: core.natural ? core.end : rightContextEnd(text, core.end, options.contextLength, segmenters),
      coreStart: core.start,
      coreEnd: core.end,
    };
  });
}

function createSegmenters(text: string, locale: string | undefined): Segmenters {
  let sentence: Intl.Segmenter;
  try {
    sentence = new Intl.Segmenter(locale === 'auto' ? undefined : locale, { granularity: 'sentence' });
  } catch {
    // LanguageTool accepts codes that are not valid BCP 47 tags for Intl.
    sentence = new Intl.Segmenter(undefined, { granularity: 'sentence' });
  }
  // A fixed slice margin cannot preserve regional-indicator parity or arbitrarily
  // long combining/ZWJ sequences. Compute boundaries against the original text.
  const graphemePositions = graphemeBoundaryPositions(text);
  return { sentence, graphemePositions, graphemeBoundaries: new Set(graphemePositions) };
}

/**
 * Grapheme boundaries are computed in windows of this many code units. Node 20's Intl.Segmenter
 * spends time proportional to its input on every segment it yields: one pass over a 100,000-unit
 * document took seconds there, against milliseconds on Node 22. Windows keep the cost linear.
 */
const GRAPHEME_WINDOW = 1_024;

/**
 * Every grapheme boundary of `text` in ascending order, `text.length` included: the positions one
 * Intl.Segmenter pass over the whole text yields. Each window resumes at the start of the previous
 * window's last cluster, which may continue past that window. That start is a confirmed boundary:
 * whether a cluster starts at a code point depends on that code point and the text before it, and no
 * UAX #29 rule looks back across a boundary except regional-indicator pairing, whose count is even
 * there. A window never ends inside a surrogate pair, whose lone half would read as another code
 * point. A cluster filling a whole window makes the window grow.
 */
export function graphemeBoundaryPositions(text: string, window = GRAPHEME_WINDOW): number[] {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const positions: number[] = [];
  let start = 0;
  let size = window;
  while (start < text.length) {
    let end = Math.min(text.length, start + size);
    if (withoutSurrogateSplit(text, end) !== end) {
      end++;
    }
    const starts = Array.from(segmenter.segment(text.slice(start, end)), ({ index }) => start + index);
    if (end < text.length && starts.length < 2) {
      size *= 2;
      continue;
    }
    const resume = end < text.length ? starts.pop()! : text.length;
    for (const position of starts) {
      positions.push(position);
    }
    start = resume;
    size = window;
  }
  positions.push(text.length);
  return positions;
}

/** Best cut in [from + half, limit]; always after `from`. */
function findCut(text: string, from: number, limit: number, segmenters: Segmenters): { position: number; natural: boolean } {
  const min = from + Math.ceil((limit - from) / 2);

  const paragraph = paragraphBreakEnds(text, from, limit).filter((end) => end >= min).at(-1);
  if (paragraph !== undefined) {
    return { position: paragraph, natural: true };
  }
  const newline = text.lastIndexOf('\n', limit - 1);
  if (newline + 1 >= min) {
    return { position: newline + 1, natural: false };
  }
  const sentence = boundaries(text, segmenters, 'sentence', min, limit).at(-1);
  if (sentence !== undefined) {
    return { position: sentence, natural: false };
  }
  const space = lastSpaceEnd(text, min, limit, segmenters);
  if (space !== undefined) {
    return { position: space, natural: false };
  }
  const grapheme = boundaries(text, segmenters, 'grapheme', min, limit).at(-1);
  // A single grapheme longer than half a core: cut at a code point boundary.
  return { position: grapheme ?? withoutSurrogateSplit(text, limit), natural: false };
}

/** Start of the context before an artificial cut: whole sentences of the same paragraph when possible. */
function leftContextStart(text: string, cut: number, contextLength: number, segmenters: Segmenters): number {
  const lo = cut - contextLength;
  if (lo <= 0) {
    return 0;
  }
  const paragraph = paragraphBreakEnds(text, lo, cut).at(-1);
  if (paragraph !== undefined) {
    return paragraph;
  }
  const sentence = boundaries(text, segmenters, 'sentence', lo, cut - 1)[0];
  if (sentence !== undefined) {
    return sentence;
  }
  const space = firstSpaceEnd(text, lo, cut - 1, segmenters);
  if (space !== undefined) {
    return space;
  }
  return boundaries(text, segmenters, 'grapheme', lo, cut - 1)[0] ?? cut;
}

/** End of the context after an artificial cut: whole sentences of the same paragraph when possible. */
function rightContextEnd(text: string, cut: number, contextLength: number, segmenters: Segmenters): number {
  const hi = cut + contextLength;
  if (hi >= text.length) {
    return text.length;
  }
  const paragraph = paragraphBreakEnds(text, cut, hi)[0];
  if (paragraph !== undefined) {
    return paragraph;
  }
  const sentence = boundaries(text, segmenters, 'sentence', cut + 1, hi).at(-1);
  if (sentence !== undefined) {
    return sentence;
  }
  const space = lastSpaceEnd(text, cut + 1, hi, segmenters);
  if (space !== undefined) {
    return space;
  }
  return boundaries(text, segmenters, 'grapheme', cut + 1, hi).at(-1) ?? cut;
}

/** Ends of the paragraph breaks lying within [from, to]. */
function paragraphBreakEnds(text: string, from: number, to: number): number[] {
  return Array.from(text.slice(from, to).matchAll(PARAGRAPH_BREAK), (match) => from + match.index + match[0].length);
}

/** Segment boundaries of the given segmenter within [lo, hi], in ascending order. */
function boundaries(text: string, segmenters: Segmenters, kind: 'sentence' | 'grapheme', lo: number, hi: number): number[] {
  if (lo > hi) {
    return [];
  }
  if (kind === 'grapheme') {
    // Binary search avoids rescanning the document for each short context window.
    const positions = segmenters.graphemePositions;
    let left = 0;
    let right = positions.length;
    while (left < right) {
      const middle = (left + right) >>> 1;
      if (positions[middle]! < lo) left = middle + 1;
      else right = middle;
    }
    const result: number[] = [];
    for (let index = left; index < positions.length && positions[index]! <= hi; index++) {
      result.push(positions[index]!);
    }
    return result;
  }
  const sliceStart = Math.max(0, lo - SEGMENTER_MARGIN);
  const slice = text.slice(sliceStart, Math.min(text.length, hi + SEGMENTER_MARGIN));
  const result: number[] = [];
  for (const { index } of segmenters.sentence.segment(slice)) {
    const position = sliceStart + index;
    // The start of the slice is only a real boundary at the start of the text.
    if ((index > 0 || sliceStart === 0) && position >= lo && position <= hi && segmenters.graphemeBoundaries.has(position)) {
      result.push(position);
    }
  }
  return result;
}

/** Latest position in [min, limit] right after a breakable space. */
function lastSpaceEnd(text: string, min: number, limit: number, segmenters: Segmenters): number | undefined {
  for (let index = limit - 1; index >= min - 1; index--) {
    if (isSpaceCut(text, index) && segmenters.graphemeBoundaries.has(index + 1)) {
      return index + 1;
    }
  }
  return undefined;
}

/** Earliest position in [lo, hi] right after a breakable space. */
function firstSpaceEnd(text: string, lo: number, hi: number, segmenters: Segmenters): number | undefined {
  for (let index = lo - 1; index < hi; index++) {
    if (isSpaceCut(text, index) && segmenters.graphemeBoundaries.has(index + 1)) {
      return index + 1;
    }
  }
  return undefined;
}

function isSpaceCut(text: string, index: number): boolean {
  return BREAKABLE_SPACE.test(text[index]!) && !(text[index] === '\r' && text[index + 1] === '\n');
}

function withoutSurrogateSplit(text: string, position: number): number {
  const before = text.charCodeAt(position - 1);
  const after = text.charCodeAt(position);
  return before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff ? position - 1 : position;
}
