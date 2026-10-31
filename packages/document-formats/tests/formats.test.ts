import { describe, expect, it } from 'vitest';
import { readDocument, mapFinding, proposeReplacement, LIMITS, revisionOf, type Document } from '../src/index.js';
import { body, docx, ns, p, zip, types } from './fixtures.js';

const prose=(doc:Document)=>doc.segments.map(s=>s.text).join('|');
const read=(text:string,format:'markdown'|'latex'='markdown')=>readDocument(text,{format});
describe('format selection, limits and coverage',()=>{
  it('uses explicit format before extension, and never guesses from content',async()=>{
    expect((await readDocument('# Heading',{filename:'sample.md'})).format).toBe('markdown');
    expect((await readDocument('# Heading',{filename:'sample.tex',format:'markdown'})).format).toBe('markdown');
    await expect(readDocument('# Heading')).rejects.toMatchObject({code:'UNSUPPORTED_FORMAT'});
    await expect(readDocument(Buffer.from('PDF'),{filename:'sample.pdf'})).rejects.toMatchObject({code:'UNSUPPORTED_FORMAT'});
  });
  it('rejects wrong inputs, invalid UTF-8, lone surrogates and oversized input without echoing content',async()=>{
    await expect(readDocument(7 as never,{format:'markdown'})).rejects.toMatchObject({code:'INVALID_INPUT'});
    await expect(readDocument(Buffer.from([0xff]),{format:'markdown'})).rejects.toMatchObject({code:'MALFORMED_DOCUMENT'});
    await expect(read('\ud800')).rejects.toMatchObject({code:'MALFORMED_DOCUMENT'});
    await expect(read('a'.repeat(LIMITS.text+1))).rejects.toMatchObject({code:'LIMIT_EXCEEDED'});
    await expect(readDocument('text',{format:'docx'})).rejects.toMatchObject({code:'INVALID_INPUT'});
  });
  it('keeps input scope separate from extraction and exposes stable snapshot-local identifiers',async()=>{
    const input='# Discussion\n\nSome text.';
    const a=await readDocument(input,{format:'markdown',scope:{kind:'partial',notProvided:['Methods']}}),b=await read(input);
    expect(a.coverage).toMatchObject({input:'partial',notProvided:['Methods'],extraction:'complete'});
    expect(b.coverage.input).toBe('unknown');expect(a.units.map(u=>u.id)).toEqual(b.units.map(u=>u.id));
    expect(a.revision).toBe(revisionOf(input));expect(Object.isFrozen(a.units)).toBe(true);
    expect(a.sections[0].title).toBe('Discussion');
  });
  it('segments long prose within LanguageTool limits without splitting graphemes',async()=>{
    const text='A 😀 e\u0301 '.repeat(6000).trimEnd(),doc=await read(text);
    expect(doc.segments.length).toBeGreaterThan(1);
    expect(doc.segments.every(s=>s.text.length<=LIMITS.segment)).toBe(true);
    expect(doc.segments.map(s=>s.text).join('')).toBe(text);
  });
});
describe('Markdown',()=>{
  it('preserves headings, hierarchy, lists, quotes, tables, notes, links and metadata',async()=>{
    const doc=await read('---\ntitle: Synthetic\n---\n# Main\n\n## Part\n\nA **clear** paragraph.\n\n- First\n- Second\n\n1. Ordered\n\n> Quoted\n\n| Header | Other |\n| --- | --- |\n| Cell | Value |\n\nA note[^n].\n\n[^n]: Synthetic note.\n');
    expect(doc.sections.map(s=>[s.level,s.parentId])).toEqual([[1,undefined],[2,'section:1']]);
    expect(doc.units.map(u=>u.kind)).toEqual(expect.arrayContaining(['metadata','heading','list','listItem','blockquote','table','tableRow','tableCell','footnoteDefinition']));
    expect(doc.units.find(u=>u.kind==='tableCell')?.metadata.tableHeader).toBe(true);
    expect(prose(doc)).toContain('Synthetic note.');expect(prose(doc)).not.toContain('title: Synthetic');
  });
  it('never submits code, destinations, images, raw HTML, citation syntax or math as prose',async()=>{
    const source='# Synthetic\n\nSome `code_call()` and [label](https://example.invalid/path) ![image](figure.png).\n\nSmith (2020) reports [3] and [@synthetic2020]. $x+y$\n\n```js\nprivate_code()\n```\n\n<span>hidden HTML</span>\n';
    const doc=await read(source),sent=prose(doc);
    for(const protectedText of ['code_call','https://','figure.png','private_code','[@synthetic2020]','[3]','(2020)','$x+y$','hidden HTML'])expect(sent).not.toContain(protectedText);
    expect(sent).toContain('label');expect(doc.coverage.extraction).toBe('partial');
    expect(doc.units.some(u=>u.text.includes('[@synthetic2020]'))).toBe(true);
    expect((await read('```\n$ literal in code\n```')).coverage.extraction).toBe('complete');
  });
  it('keeps malformed fences and unclosed frontmatter protected, and reports encoded text limits',async()=>{
    expect(prose(await read('```\nnot prose'))).toBe('');
    const metadata=await read('---\ntitle: Unclosed');expect(prose(metadata)).toBe('');expect(metadata.coverage.extraction).toBe('partial');
    const encoded=await read('A &amp; B with an escaped \\* marker.');expect(encoded.coverage.extraction).toBe('partial');
    const math=await read('Visible $unclosed math');expect(prose(math)).not.toContain('unclosed');expect(math.coverage.extraction).toBe('partial');
  });
});
describe('LaTeX',()=>{
  it('represents sections and preserves commands, citation keys, refs, comments and escaped characters',async()=>{
    const source=String.raw`\section{Methods}
Some \emph{clear} prose with \autoref{fig:synthetic}, \label{sec:synthetic} and \citep{synthetic2020}.
% hidden comment
An escaped \% sign remains.

\subsection{Sampling}
Other prose.`;
    const doc=await read(source,'latex'),sent=prose(doc);
    expect(doc.sections.map(s=>s.title)).toEqual(['Methods','Sampling']);
    for(const value of ['autoref','fig:synthetic','sec:synthetic','synthetic2020','hidden comment','\\%'])expect(sent).not.toContain(value);
    expect(sent).toContain('clear');expect(sent).toContain('Other prose.');
    expect(doc.units.flatMap(u=>(u.metadata.markers??[]) as {kind:string}[]).some(m=>m.kind==='citation')).toBe(true);
  });
  it('protects all supported math and opaque environments without compiling',async()=>{
    const source=String.raw`Prose $x+y$ and \(a=b\), \[c=d\], $$z=0$$.
\begin{equation}q=1\end{equation}
\begin{align}u&=v\end{align}
\begin{verbatim}\write18{never_execute}\end{verbatim}
\begin{figure}\caption{Synthetic caption}\label{fig:one}\end{figure}
After.`;
    const sent=prose(await read(source,'latex'));
    for(const value of ['x+y','a=b','c=d','z=0','q=1','u&=v','never_execute','fig:one'])expect(sent).not.toContain(value);
    expect(sent).toContain('After.');
  });
  it('does not expose math after a commented terminator or nested environment',async()=>{
    const source=String.raw`Before.
\begin{align}
x=y % \end{align}
secret_math
\begin{align}nested\end{align}
\end{align}
After.`;
    const sent=prose(await read(source,'latex'));expect(sent).not.toContain('secret_math');expect(sent).not.toContain('nested');expect(sent).toContain('After.');
  });
  it.each([String.raw`Before $unclosed`,String.raw`Before \cite{unclosed`,String.raw`Before \begin{align}unclosed`,String.raw`Before \(unclosed`])('recovers safely from an unclosed region',async source=>{
    const doc=await read(source,'latex');expect(prose(doc)).toContain('Before');expect(prose(doc)).not.toContain('unclosed');expect(doc.coverage.extraction).toBe('partial');
  });
  it('does not submit preamble, macro definitions, verbatim arguments or included files',async()=>{
    const source=String.raw`\documentclass{article}
\begin{document}
Visible \verb|private_code|. \input{other-file.tex}
\end{document}`;
    const doc=await read(source,'latex');expect(prose(doc)).toContain('Visible');expect(prose(doc)).not.toMatch(/private_macro|private_code|other-file/);
    expect(doc.coverage.omissions.some(o=>o.code==='EXTERNAL_TEX_RESOURCE_NOT_READ')).toBe(true);
  });
  it('keeps citation arguments protected across comments and newlines, and retains notes separately',async()=>{
    const source=String.raw`Some \citep% comment
 [see][4]
 {synthetic-key} prose. \footnote{Synthetic note \cite{other-key}.}`;
    const doc=await read(source,'latex');expect(prose(doc)).not.toMatch(/synthetic-key|other-key|Synthetic note|comment/);
    expect(doc.units.some(u=>u.kind==='footnote'&&u.text.includes('Synthetic note'))).toBe(true);
  });
  it('does not read text after the active document or interpret dynamic TeX',async()=>{
    const doc=await read(String.raw`\begin{document}Visible\end{document}Not active`,'latex');
    expect(prose(doc)).toContain('Visible');expect(prose(doc)).not.toContain('Not active');
    const dynamic=await read(String.raw`Before \iffalse Inactive text \fi After`,'latex');
    expect(prose(dynamic)).not.toContain('Inactive');expect(dynamic.coverage.omissions.map(o=>o.code)).toContain('DYNAMIC_TEX_NOT_INTERPRETED');
    const definition=await read(String.raw`\def\synthetic
{macro_body} Visible {group}~text`,'latex');
    expect(prose(definition)).toBe('');expect(definition.coverage.omissions.map(o=>o.code)).toContain('DYNAMIC_TEX_NOT_INTERPRETED');
  });
  it('does not expose an unbraced included filename or make a preamble heading active',async()=>{
    const source=String.raw`\section{Not active}
\begin{document}
Visible. \input references.tex
\end{document}`;
    const doc=await read(source,'latex');expect(doc.sections).toEqual([]);
    expect(prose(doc)).toContain('Visible.');expect(prose(doc)).not.toMatch(/references\.tex|Not active/);
    expect(doc.coverage.omissions.map(o=>o.code)).toContain('EXTERNAL_TEX_RESOURCE_NOT_READ');
  });
  it('treats prototype-like command names as opaque unknown commands',async()=>{
    const doc=await read(String.raw`\toString{opaque} \constructor{hidden} Ordinary text.`,'latex');
    expect(doc.sections).toEqual([]);expect(prose(doc)).not.toMatch(/opaque|hidden/);expect(prose(doc)).toContain('Ordinary text.');
  });
  it.each([String.raw`\let\textbf\phantom`,String.raw`\renewcommand{\textbf}[1]{}`,String.raw`\def\textbf#1{}`])('withholds the remainder after a command redefinition',async definition=>{
    const doc=await read(`\\begin{document}\nBefore. ${definition}\n\\textbf{Invisible content} Visible.\n\\end{document}`,'latex');
    expect(prose(doc)).toContain('Before.');expect(prose(doc)).not.toMatch(/Invisible|Visible/);
    expect(doc.coverage.omissions.map(o=>o.code)).toContain('DYNAMIC_TEX_NOT_INTERPRETED');
    expect(doc.coverage.omissions.map(o=>o.code)).not.toContain('UNCLOSED_ENVIRONMENT');
  });
});
describe('source mappings and proposals',()=>{
  it.each(['markdown','latex'] as const)('maps a finding through %s markup without applying a change',async format=>{
    const source=format==='markdown'?'😀 The **reslts** are visible [3].':String.raw`😀 The \emph{reslts} are visible \cite{synthetic}.`;
    const doc=await read(source,format),segment=doc.segments.find(s=>s.text.includes('reslts'))!;
    const finding={revision:doc.revision,segmentId:segment.id,offset:segment.text.indexOf('reslts'),length:6};
    const proposal=proposeReplacement(doc,finding,'results');
    expect(source.slice(proposal.location.start,proposal.location.end)).toBe('reslts');expect(proposal.applied).toBe(false);
    const simulated=source.slice(0,proposal.location.start)+proposal.replacement+source.slice(proposal.location.end);
    expect(simulated).toBe(source.replace('reslts','results'));expect(doc.units.some(u=>u.text.includes('reslts'))).toBe(true);
  });
  it('rejects stale, forged, out-of-range and grapheme-splitting mappings',async()=>{
    const doc=await read('😀 e\u0301 text'),segment=doc.segments[0];
    const f={revision:doc.revision,segmentId:segment.id,offset:0,length:2};
    expect(mapFinding(doc,f)).toMatchObject({start:0,end:2});
    for(const invalid of [{...f,offset:1,length:1},{...f,offset:3,length:1},{...f,length:999},{...f,length:-1},{...f,offset:0.1}])expect(()=>mapFinding(doc,invalid)).toThrow();
    expect(()=>mapFinding(doc,{...f,revision:'stale'})).toThrow('stale location');
    expect(()=>mapFinding(JSON.parse(JSON.stringify(doc)) as Document,f)).toThrow('invalid input');
  });
});
describe('DOCX structured read-only extraction',()=>{
  it('reads headings, styled runs, lists, cells, links, notes, captions and metadata',async()=>{
    const xml=body(`<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Methods</w:t></w:r></w:p>
      <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Bold </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>italic 😀</w:t></w:r><w:hyperlink r:id="link1"><w:r><w:t> label</w:t></w:r></w:hyperlink><w:r><w:footnoteReference w:id="1"/></w:r></w:p>
      <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="7"/></w:numPr></w:pPr><w:r><w:t>Item</w:t></w:r></w:p>
      <w:tbl><w:tr><w:tc>${p('Cell one')}</w:tc><w:tc>${p('Cell two')}</w:tc></w:tr></w:tbl>
      <w:p><w:pPr><w:pStyle w:val="Caption"/></w:pPr><w:r><w:t>Figure 1. Synthetic caption</w:t></w:r></w:p>`);
    const input=docx(xml,[{name:'word/footnotes.xml',data:`<w:footnotes xmlns:w="${ns}"><w:footnote w:id="1">${p('Synthetic note')}</w:footnote></w:footnotes>`},
      {name:'word/_rels/document.xml.rels',data:'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="link1" Target="https://example.invalid/source" TargetMode="External"/></Relationships>'},
      {name:'docProps/core.xml',data:'<core><title>Synthetic title</title></core>'}]);
    const before=Buffer.from(input),doc=await readDocument(input,{format:'docx'});
    expect(input.equals(before)).toBe(true);expect(doc.units.map(u=>u.kind)).toEqual(expect.arrayContaining(['heading','listItem','table','row','cell','footnote','caption','metadata']));
    const styled=doc.units.find(u=>u.text.startsWith('Bold'))!;
    expect(styled.metadata.runs).toEqual(expect.arrayContaining([expect.objectContaining({styles:{b:true}}),expect.objectContaining({styles:{i:true}})]));
    expect(prose(doc)).not.toContain('https://');expect(prose(doc)).toContain('Synthetic note');
    expect(doc.units.filter(u=>u.kind==='paragraph'&&u.text.startsWith('Cell')).map(u=>u.location.path)).toEqual(expect.arrayContaining([expect.stringContaining('/cell/1/'),expect.stringContaining('/cell/2/')]));
  });
  it('maps decoded XML text to run/text-node coordinates rather than imaginary XML offsets',async()=>{
    const doc=await readDocument(docx(body(p('A &amp; 😀 reslts'))),{format:'docx'}),s=doc.segments[0];
    expect(s.text).toBe('A & 😀 reslts');
    expect(mapFinding(doc,{revision:doc.revision,segmentId:s.id,offset:s.text.indexOf('reslts'),length:6})).toMatchObject({part:'word/document.xml',run:1,textNode:1,start:7,end:13});
  });
  it('protects fields, citations split across runs, revisions and unsupported drawings',async()=>{
    const doc=await readDocument(docx(body(`<w:p><w:r><w:t>Prior [</w:t></w:r><w:r><w:t>3] </w:t></w:r>
      <w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>CITATION synthetic</w:instrText></w:r>
      <w:r><w:t>FIELD_VALUE</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>
      <w:ins><w:r><w:t>REVISION</w:t></w:r></w:ins><w:r><w:drawing/></w:r><w:r><w:t>After</w:t></w:r></w:p>`)),{format:'docx'});
    const sent=prose(doc);expect(sent).not.toMatch(/\[3\]|CITATION|FIELD_VALUE|REVISION/);expect(sent).toContain('After');expect(doc.coverage.extraction).toBe('partial');
  });
  it('does not split graphemes across styled runs and reports missing note content',async()=>{
    const doc=await readDocument(docx(body('<w:p><w:r><w:t>e</w:t></w:r><w:r><w:t>\u0301</w:t></w:r><w:r><w:footnoteReference w:id="9"/></w:r></w:p>')),{format:'docx'});
    expect(prose(doc)).toBe('');expect(doc.coverage.omissions.map(o=>o.code)).toEqual(expect.arrayContaining(['SPLIT_GRAPHEME_NOT_SUBMITTED','NOTE_CONTENT_NOT_AVAILABLE']));
  });
  it('keeps endnotes separate, identifies table header rows, and handles invisible runs',async()=>{
    const xml=body(`<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Results</w:t></w:r></w:p>
      <w:tbl><w:tr><w:trPr><w:tblHeader/></w:trPr><w:tc>${p('Header')}</w:tc></w:tr></w:tbl>
      <w:p><w:r><w:rPr><w:vanish/></w:rPr><w:t>Hidden</w:t></w:r><w:r><w:rPr><w:vanish w:val="false"/></w:rPr><w:t>Visible</w:t></w:r><w:r><w:endnoteReference w:id="2"/></w:r></w:p>`);
    const doc=await readDocument(docx(xml,[{name:'word/endnotes.xml',data:`<w:endnotes xmlns:w="${ns}"><w:endnote w:id="2">${p('Endnote text')}</w:endnote></w:endnotes>`}]),{format:'docx'});
    expect(doc.units.find(u=>u.kind==='row')?.metadata.tableHeader).toBe(true);
    expect(prose(doc)).not.toContain('Hidden');expect(prose(doc)).toContain('Visible');
    expect(doc.units.find(u=>u.text==='Endnote text')?.location.sections).toEqual([]);
  });
  it('keeps heading mappings in their own section and caption numbering protected',async()=>{
    const xml=body('<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Methods</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="Caption"/></w:pPr><w:r><w:t>Figure 1. Synthetic caption</w:t></w:r></w:p>');
    const doc=await readDocument(docx(xml),{format:'docx'});
    expect(doc.segments.find(s=>s.text==='Methods')?.location.sections).toEqual(['section:1']);
    expect(prose(doc)).not.toContain('Figure 1.');expect(prose(doc)).toContain('Synthetic caption');
  });
});
describe('DOCX package and XML safety',()=>{
  it('rejects malformed packages, missing parts, encrypted data and unsafe entry paths',async()=>{
    for(const bytes of [Buffer.from('not a zip'),zip([{name:'word/document.xml',data:body(p('Text'))}]),
      docx(body(p('Text')),[{name:'../outside',data:'unsafe'}]),docx(body(p('Text')),[{name:'/absolute',data:'unsafe'}]),
      docx(body(p('Text')),[{name:'word/document.xml',data:body(p('Duplicate'))}])])await expect(readDocument(bytes,{format:'docx'})).rejects.toMatchObject({code:'MALFORMED_DOCUMENT'});
    await expect(readDocument(docx(body(p('Text')),[{name:'encrypted',data:'data',flags:1,deflate:true}]),{format:'docx'})).rejects.toMatchObject({code:'UNSUPPORTED_FEATURE'});
  });
  it('rejects DTDs, external entities, excessive nesting and macro-enabled content types',async()=>{
    const dtd='<!DOCTYPE w:document [<!ENTITY synthetic SYSTEM "https://example.invalid/never-fetch">]>'+body(p('&synthetic;'));
    await expect(readDocument(docx(dtd),{format:'docx'})).rejects.toMatchObject({code:'UNSUPPORTED_FEATURE'});
    await expect(readDocument(docx(body('<w:x>'.repeat(260)+'</w:x>'.repeat(260))),{format:'docx'})).rejects.toMatchObject({code:'LIMIT_EXCEEDED'});
    await expect(readDocument(zip([{name:'[Content_Types].xml',data:types.replace('application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml','application/vnd.ms-word.document.macroEnabled.main+xml')},{name:'word/document.xml',data:body(p('Text'))}]),{format:'docx'})).rejects.toMatchObject({code:'UNSUPPORTED_FEATURE'});
  });
  it('bounds declared and actual expanded bytes and entry counts',async()=>{
    await expect(readDocument(docx(body(p('Text')),[{name:'large',data:'x',declaredSize:LIMITS.entry+1,deflate:true}]),{format:'docx'})).rejects.toMatchObject({code:'LIMIT_EXCEEDED'});
    const bomb=zip([{name:'[Content_Types].xml',data:types},{name:'word/document.xml',data:'x'.repeat(200_000),deflate:true,declaredSize:1}]);
    await expect(readDocument(bomb,{format:'docx'})).rejects.toBeDefined();
    const many=docx(body(p('Text')),Array.from({length:LIMITS.entries},(_,i)=>({name:`ignored/${i}`,data:''})));
    await expect(readDocument(many,{format:'docx'})).rejects.toMatchObject({code:'LIMIT_EXCEEDED'});
  });
  it('sanitizes parser errors without echoing document text',async()=>{
    const marker='SYNTHETIC_PRIVATE_MARKER';
    try {await readDocument(docx(body(`<w:p>${marker}&undefined;</w:p>`)),{format:'docx'});expect.fail('expected error');}
    catch(error){expect((error as Error).message).not.toContain(marker);expect((error as {code:string}).code).toBe('MALFORMED_DOCUMENT');}
  });
});
