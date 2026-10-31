import { expect, it } from 'vitest';
import { readDocument, LIMITS } from '../src/index.js';
import { body, docx, p, ns } from './fixtures.js';

it('does not let historical run properties expose currently hidden text',async()=>{
  const xml=body('<w:p><w:r><w:rPr><w:vanish/><w:rPrChange w:id="1"><w:rPr><w:vanish w:val="0"/></w:rPr></w:rPrChange></w:rPr><w:t>SYNTHETIC_HIDDEN_NOTE</w:t></w:r></w:p>');
  const doc=await readDocument(docx(xml),{format:'docx'});
  expect(doc.segments).toEqual([]);
  expect(doc.coverage.omissions.map(o=>o.code)).toContain('DOCX_OPAQUE_CONTENT');
});

it('does not classify an old paragraph style as the current heading',async()=>{
  const xml=body('<w:p><w:pPr><w:pPrChange w:id="1"><w:pPr><w:pStyle w:val="Heading1"/></w:pPr></w:pPrChange></w:pPr><w:r><w:t>Current paragraph</w:t></w:r></w:p>');
  const doc=await readDocument(docx(xml),{format:'docx'});expect(doc.sections).toEqual([]);
});

it.each(['footnotes','endnotes'])('resolves %s hyperlinks relative to their owning part',async notePart=>{
  const singular=notePart==='footnotes'?'footnote':'endnote';
  const rel=(target:string)=>`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="${target}" TargetMode="External"/></Relationships>`;
  const notes=`<w:${notePart} xmlns:w="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:${singular} w:id="1"><w:p><w:hyperlink r:id="rId1"><w:r><w:t>Note link</w:t></w:r></w:hyperlink></w:p></w:${singular}></w:${notePart}>`;
  const doc=await readDocument(docx(body(p('Main')), [{name:'word/_rels/document.xml.rels',data:rel('https://main.invalid')},
    {name:`word/${notePart}.xml`,data:notes},{name:`word/_rels/${notePart}.xml.rels`,data:rel('https://notes.invalid')}]),{format:'docx'});
  const note=doc.units.find(u=>u.text==='Note link')!;
  expect(note.metadata.runs).toEqual([expect.objectContaining({relationship:expect.objectContaining({target:'https://notes.invalid'})})]);
});

it('includes core metadata in the aggregate extracted-text budget',async()=>{
  const value='x'.repeat(Math.floor(LIMITS.text/3)+1);
  const metadata=`<core><title>${value}</title><subject>${value}</subject><language>${value}</language></core>`;
  await expect(readDocument(docx(body(p('Body')),[{name:'docProps/core.xml',data:metadata}]),{format:'docx'})).rejects.toMatchObject({code:'LIMIT_EXCEEDED'});
});

it('retains object markers and coverage for visible special-character elements',async()=>{
  const xml=body('<w:p><w:r><w:t>alpha</w:t><w:noBreakHyphen/><w:t>beta</w:t><w:sym w:font="Symbol" w:char="F061"/></w:r></w:p>');
  const doc=await readDocument(docx(xml),{format:'docx'});
  const unit=doc.units.find(u=>u.kind==='paragraph')!;
  expect(unit.text).toBe('alpha\uFFFCbeta\uFFFC');
  expect(unit.metadata.markers).toEqual(expect.arrayContaining([expect.objectContaining({kind:'noBreakHyphen'}),expect.objectContaining({kind:'sym'})]));
  expect(doc.coverage.omissions.map(o=>o.code)).toContain('DOCX_SPECIAL_CHARACTER_NOT_DECODED');
});

it('does not insert visible markers for historical property records',async()=>{
  const xml=body('<w:p><w:pPr><w:pStyle w:val="Caption"/><w:pPrChange w:id="1"><w:pPr><w:pStyle w:val="Normal"/></w:pPr></w:pPrChange></w:pPr><w:r><w:t>Figure 1. Caption text</w:t></w:r></w:p>');
  const doc=await readDocument(docx(xml),{format:'docx'});
  expect(doc.units.find(u=>u.kind==='caption')?.text).toBe('Figure 1. Caption text');
  expect(doc.segments.map(s=>s.text).join('|')).not.toContain('Figure 1.');
});

it('does not break a visible grapheme with historical property metadata',async()=>{
  const xml=body('<w:p><w:r><w:t>e</w:t></w:r><w:r><w:rPr><w:rPrChange w:id="1"><w:rPr><w:b/></w:rPr></w:rPrChange></w:rPr><w:t>&#x301;</w:t></w:r></w:p>');
  const doc=await readDocument(docx(xml),{format:'docx'});
  expect(doc.units.find(u=>u.kind==='paragraph')?.text).toBe('e\u0301');
  expect(doc.segments).toEqual([]);
  expect(doc.coverage.omissions.map(o=>o.code)).toContain('SPLIT_GRAPHEME_NOT_SUBMITTED');
});

it.each(['before','between'])('protects caption numbering with bookmark markers %s its label',async position=>{
  const marker='<w:bookmarkStart w:id="1" w:name="synthetic"/>';
  const content=position==='before'?`${marker}<w:r><w:t>Figure 1. Caption text</w:t></w:r>`:
    `<w:r><w:t>Figure </w:t></w:r>${marker}<w:r><w:t>1. Caption text</w:t></w:r>`;
  const xml=body(`<w:p><w:pPr><w:pStyle w:val="Caption"/></w:pPr>${content}<w:bookmarkEnd w:id="1"/></w:p>`);
  const doc=await readDocument(docx(xml),{format:'docx'});
  expect(doc.segments.map(s=>s.text).join('|')).not.toMatch(/Figure|1\./u);
  expect(doc.segments.map(s=>s.text).join('|')).toContain('Caption text');
});
