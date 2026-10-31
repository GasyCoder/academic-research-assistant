import { expect, it } from 'vitest';
import { readDocument, mapFinding } from '../src/index.js';

it.each(['`$` normal prose $SYNTHETIC_MATH$ `$` after.',
  '[link](https://example.invalid/$) normal $SYNTHETIC_MATH$ after.'])('ignores protected dollars when finding real math',async source=>{
  const doc=await readDocument(source,{format:'markdown'});
  expect(doc.segments.map(s=>s.text).join('|')).not.toContain('SYNTHETIC_MATH');
  const math=source.indexOf('SYNTHETIC_MATH');
  for(const s of doc.segments)expect(s.location.end!<=math||s.location.start!>=math+'SYNTHETIC_MATH'.length).toBe(true);
});

it.each(['---\n---\nVisible prose.','---\r\n---\r\nVisible prose.'])('accepts an empty YAML frontmatter block',async source=>{
  const doc=await readDocument(source,{format:'markdown'});
  expect(doc.units[0].kind).toBe('metadata');
  expect(doc.segments.map(s=>s.text)).toEqual(['Visible prose.']);
  expect(doc.coverage.extraction).toBe('complete');
});

it.each(['\n','\r\n'])('handles a string BOM without exposing metadata or shifting mappings',async newline=>{
  const source=`\ufeff---${newline}title: SYNTHETIC_CONFIGURATION${newline}---${newline}# Main${newline}${newline}Visible prose.`;
  const doc=await readDocument(source,{format:'markdown'});
  expect(doc.sections.map(s=>s.title)).toEqual(['Main']);
  expect(doc.segments.map(s=>s.text)).toEqual(['Main','Visible prose.']);
  for(const s of doc.segments){
    const location=mapFinding(doc,{revision:doc.revision,segmentId:s.id,offset:0,length:s.text.length});
    expect(source.slice(location.start,location.end)).toBe(s.text);
  }
  expect(doc.coverage.extraction).toBe('complete');
});

it('withholds deeply nested inline Markdown without a stack overflow',async()=>{
  const doc=await readDocument('***'.repeat(2000)+'text'+'***'.repeat(2000),{format:'markdown'});
  expect(doc.segments).toEqual([]);
  expect(doc.coverage.omissions.map(o=>o.code)).toContain('MARKDOWN_NESTING_LIMIT');
});
