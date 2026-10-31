import { createHash } from 'node:crypto';

export type Format = 'markdown' | 'latex' | 'docx';
export type ErrorCode = 'INVALID_INPUT' | 'UNSUPPORTED_FORMAT' | 'MALFORMED_DOCUMENT' |
  'EXTRACTION_FAILURE' | 'UNSUPPORTED_FEATURE' | 'LIMIT_EXCEEDED' | 'STALE_LOCATION';
export class DocumentError extends Error {
  constructor(public readonly code: ErrorCode) { super(code.toLowerCase().replaceAll('_', ' ')); this.name = 'DocumentError'; }
}
export const LIMITS = Object.freeze({ text: 2_000_000, archive: 20 * 1024 * 1024,
  entry: 8 * 1024 * 1024, expanded: 40 * 1024 * 1024, entries: 2000, units: 50_000,
  segment: 40_000, xmlDepth: 256 });
export interface Location {
  part: string; path: string; sections: string[];
  /** UTF-16 source range for text formats; never an XML byte offset. */
  start?: number; end?: number;
  /** DOCX text-node coordinates, scoped to part and paragraph path. */
  run?: number; textNode?: number;
}
export interface Span { start: number; end: number; kind: string }
export interface Unit {
  id: string; kind: string; text: string; location: Location;
  protected: Span[]; metadata: Record<string, unknown>;
}
export interface Segment { id: string; unitId: string; text: string; unitStart: number; location: Location }
export interface Section { id: string; level: number; title: string; parentId?: string }
export interface Scope { kind: 'complete' | 'partial' | 'unknown'; notProvided?: string[] }
export interface Document {
  modelVersion: 1; format: Format; revision: string; sections: Section[]; units: Unit[]; segments: Segment[];
  coverage: { input: Scope['kind']; extraction: 'complete' | 'partial'; notProvided: string[];
    omissions: { code: string; location?: Location }[] };
}
export interface Range { start: number; end: number }
export const revisionOf = (input: string | Uint8Array) => createHash('sha256').update(input).digest('hex');
const graphemes = new Intl.Segmenter('und', { granularity: 'grapheme' });
const boundaries = (text: string) => {
  const edges=new Set([0,text.length]);
  for(const {index} of graphemes.segment(text))edges.add(index);
  return edges;
};
const snapshots = new WeakMap<Document, Map<string, Segment>>();

/** Conservative syntax protection, not citation identification or validation. */
export function inlineProtection(text: string, excluded: Span[] = []): Span[] {
  const patterns: [string, RegExp][] = [
    ['url', /(?:https?:\/\/|www\.)[^\s<>]+/gu],
    ['citation', /\[(?:@[^\]\n]+|\d+(?:\s*[,–-]\s*\d+)*)\]/gu],
  ];
  const spans=patterns.flatMap(([kind, pattern]) => Array.from(text.matchAll(pattern), m => ({start:m.index, end:m.index+m[0].length,kind})));
  for(const match of text.matchAll(/\([^()\n]*\)/gu)) {
    if((/\p{L}/u.test(match[0])&&/\b\d{4}[a-z]?\b/u.test(match[0]))||/^\(\d{4}[a-z]?(?:\s*[,;]\s*\d{4}[a-z]?)*\)$/u.test(match[0]))
      spans.push({start:match.index,end:match.index+match[0].length,kind:'citation'});
  }
  // Syntax inside code, link destinations, fields or other exclusions must not act as
  // delimiters for surrounding prose. Keep scanning the whole unit for cross-run markers.
  const ignored=union([...excluded,...spans]);
  const ignoredAt=(index:number):Span|undefined=>{
    let low=0,high=ignored.length-1;
    while(low<=high){const middle=(low+high)>>>1,span=ignored[middle];
      if(index<span.start)high=middle-1;else if(index>=span.end)low=middle+1;else return span;}
    return undefined;
  };
  const isEscaped=(index:number)=>{
    let count=0;for(let n=index-1;n>=0&&text[n]==='\\';n--)count++;return count%2===1;
  };
  for(let at=0;at<text.length;at++) {
    if(text[at]!=='$')continue;
    const skip=ignoredAt(at);if(skip){at=skip.end-1;continue;}
    if(isEscaped(at))continue;
    const delimiter=text.startsWith('$$',at)&&!ignoredAt(at+1)?'$$':'$';
    let end=text.indexOf(delimiter,at+delimiter.length);
    while(end>=0&&(isEscaped(end)||ignoredAt(end)||ignoredAt(end+delimiter.length-1)))end=text.indexOf(delimiter,end+delimiter.length);
    spans.push({start:at,end:end<0?text.length:end+delimiter.length,kind:end<0?'unclosedMath':'math'});
    at=end<0?text.length:end+delimiter.length-1;
  }
  return spans;
}
function union(spans: Span[]): Span[] {
  const result: Span[] = [];
  for (const span of spans.filter(s => s.end > s.start).sort((a,b) => a.start-b.start || b.end-a.end)) {
    const previous = result.at(-1);
    if (previous && span.start < previous.end) previous.end = Math.max(previous.end, span.end);
    else result.push({...span});
  }
  return result;
}
function freeze(value: unknown): void {
  const queue: object[] = [value as object];
  while (queue.length) {
    const current = queue.pop()!;
    if (Object.isFrozen(current)) continue;
    Object.freeze(current);
    for (const v of Object.values(current)) if (v && typeof v === 'object') queue.push(v);
  }
}
export class Builder {
  readonly document: Document;
  private headingStack: Section[] = [];
  constructor(format: Format, source: string | Uint8Array, scope: Scope = {kind:'unknown'}) {
    if (!scope || !['complete','partial','unknown'].includes(scope.kind) ||
      (scope.notProvided !== undefined && (!Array.isArray(scope.notProvided) || scope.notProvided.some(s => typeof s !== 'string')))) throw new DocumentError('INVALID_INPUT');
    this.document = {modelVersion:1,format,revision:revisionOf(source),sections:[],units:[],segments:[],
      coverage:{input:scope.kind,extraction:'complete',notProvided:[...(scope.notProvided ?? [])],omissions:[]}};
  }
  omit(code: string, location?: Location): void {
    this.document.coverage.extraction = 'partial';
    if (!this.document.coverage.omissions.some(o => o.code === code && o.location?.path === location?.path && o.location?.part === location?.part))
      this.document.coverage.omissions.push({code,location});
  }
  heading(title: string, level: number): void {
    while (this.headingStack.length && this.headingStack.at(-1)!.level >= level) this.headingStack.pop();
    const section = {id:`section:${this.document.sections.length+1}`,level,title,parentId:this.headingStack.at(-1)?.id};
    this.document.sections.push(section); this.headingStack.push(section);
  }
  location(part: string, path: string, start?: number, end?: number): Location {
    return {part,path,sections:part==='source'||part==='word/document.xml'?this.headingStack.map(s => s.id):[],start,end};
  }
  add(kind: string, text: string, location: Location, eligible: Range[] = [], metadata: Record<string,unknown> = {},
      mappings?: {start:number;end:number;location:Location}[]): Unit {
    if (this.document.units.length >= LIMITS.units) throw new DocumentError('LIMIT_EXCEEDED');
    const protection: Span[] = [];
    let at = 0;
    for (const range of [...eligible].sort((a,b) => a.start-b.start)) {
      if (range.start > at) protection.push({start:at,end:range.start,kind});
      at = Math.max(at,range.end);
    }
    if (at < text.length) protection.push({start:at,end:text.length,kind});
    const inline=eligible.length?inlineProtection(text,protection):[];
    protection.push(...inline);
    if(inline.some(s=>s.kind==='unclosedMath'))this.omit('UNCLOSED_MATH_NOT_SUBMITTED',location);
    if(kind==='caption') {
      const label=/^[\s\uFFFC]*(?:[\p{L}.]+[\s\uFFFC]+)?\d+(?:[.-]\d+)*[.:]?/u.exec(text);
      if(label)protection.push({start:0,end:label[0].length,kind:'captionLabel'});
    }
    const unit: Unit = {id:`unit:${this.document.units.length+1}`,kind,text,location,protected:union(protection),metadata};
    this.document.units.push(unit);
    if(eligible.length===0)return unit;
    const edges = boundaries(text);
    for (const range of eligible) {
      let start = range.start;
      const emit = (end: number) => {
        // Never begin/end a submission inside an extended grapheme, including across DOCX runs.
        const originalStart=start,originalEnd=end;
        while (start < end && !edges.has(start)) start++;
        while (end > start && !edges.has(end)) end--;
        if(start!==originalStart||end!==originalEnd) this.omit('SPLIT_GRAPHEME_NOT_SUBMITTED',location);
        while (end > start) {
          let stop = Math.min(end,start+LIMITS.segment);
          while (stop > start && !edges.has(stop)) stop--;
          if (stop === start) throw new DocumentError('LIMIT_EXCEEDED');
          const plain = text.slice(start,stop);
          const mapping = mappings?.find(m => start >= m.start && stop <= m.end);
          if (plain.trim() && (!mappings || mapping)) {
            if (this.document.segments.length >= LIMITS.units) throw new DocumentError('LIMIT_EXCEEDED');
            const sourceLocation = mapping ? {...mapping.location,start:start-mapping.start,end:stop-mapping.start} :
              {...location,start:(location.start ?? 0)+start,end:(location.start ?? 0)+stop};
            this.document.segments.push({id:`segment:${this.document.segments.length+1}`,unitId:unit.id,text:plain,unitStart:start,location:sourceLocation});
          }
          start = stop;
        }
      };
      for (const span of unit.protected) {
        if (span.end <= start || span.start >= range.end) continue;
        emit(Math.min(span.start,range.end)); start = Math.max(start,span.end);
      }
      emit(range.end);
    }
    return unit;
  }
  finish(): Document {
    snapshots.set(this.document,new Map(this.document.segments.map(s => [s.id,s])));
    freeze(this.document); return this.document;
  }
}
export interface Finding { revision: string; segmentId: string; offset: number; length: number }
/** Offset/length are relative to the exact submitted segment, measured in UTF-16. */
export function mapFinding(document: Document, finding: Finding): Location {
  if (!finding || finding.revision !== document?.revision) throw new DocumentError('STALE_LOCATION');
  const segment = snapshots.get(document)?.get(finding.segmentId);
  if (!segment || !Number.isSafeInteger(finding.offset) || !Number.isSafeInteger(finding.length) ||
      finding.offset < 0 || finding.length < 0 || finding.offset+finding.length > segment.text.length) throw new DocumentError('INVALID_INPUT');
  const unit = document.units.find(u => u.id === segment.unitId)!;
  const edges = boundaries(unit.text);
  if (!edges.has(segment.unitStart+finding.offset) || !edges.has(segment.unitStart+finding.offset+finding.length)) throw new DocumentError('INVALID_INPUT');
  return {...segment.location,start:segment.location.start!+finding.offset,end:segment.location.start!+finding.offset+finding.length};
}
/** Proposal only: never edits a source, serializes DOCX or trusts an unverified global offset. */
export function proposeReplacement(document: Document, finding: Finding, replacement: string) {
  if (typeof replacement !== 'string' || replacement.length > LIMITS.segment) throw new DocumentError('INVALID_INPUT');
  return {revision:document.revision,location:mapFinding(document,finding),replacement,applied:false as const};
}
