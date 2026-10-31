import { expect, it } from 'vitest';
import { readDocument } from '../src/index.js';

it('does not end citation options on a bracket within a braced group',async()=>{
  const source=String.raw`\begin{document}Before \cite[see {]}]{synthetic-key} after.\end{document}`;
  const doc=await readDocument(source,{format:'latex'});
  expect(doc.segments.map(s=>s.text).join('|')).not.toMatch(/synthetic-key|\]/u);
  expect(doc.segments.map(s=>s.text).join('|')).toContain('Before');
});

it.each(['verb','verb*'])('does not close an opaque environment inside inline %s',async command=>{
  const source=`\\begin{document}Before. \\begin{figure}\\${command}|\\end{figure}| SYNTHETIC_FIGURE_BODY \\end{figure} After.\\end{document}`;
  const doc=await readDocument(source,{format:'latex'});
  expect(doc.segments.map(s=>s.text).join('|')).not.toContain('SYNTHETIC_FIGURE_BODY');
  expect(doc.segments.map(s=>s.text).join('|')).toContain('After.');
  expect(doc.coverage.omissions.map(o=>o.code)).not.toContain('MISMATCHED_ENVIRONMENT');
});

it.each(['verbatim','lstlisting','minted'])('ignores outer terminators within a nested %s environment',async environment=>{
  const source=`\\begin{document}Before. \\begin{figure}\\begin{${environment}}\\end{figure}\\end{${environment}} SYNTHETIC_FIGURE_BODY \\end{figure} After.\\end{document}`;
  const doc=await readDocument(source,{format:'latex'});
  expect(doc.segments.map(s=>s.text).join('|')).not.toContain('SYNTHETIC_FIGURE_BODY');
  expect(doc.segments.map(s=>s.text).join('|')).toContain('After.');
});

it.each(['@','+','!'])('honors %s as an inline verbatim delimiter',async delimiter=>{
  const source=`\\begin{document}Before. \\verb${delimiter}SYNTHETIC CODE${delimiter} After.\\end{document}`;
  const doc=await readDocument(source,{format:'latex'});
  expect(doc.segments.map(s=>s.text).join('|')).not.toContain('CODE');
  expect(doc.segments.map(s=>s.text).join('|')).toContain('After.');
  const figure=await readDocument(`\\begin{document}\\begin{figure}\\verb${delimiter}\\end{figure}${delimiter} SYNTHETIC_FIGURE_BODY \\end{figure} After.\\end{document}`,{format:'latex'});
  expect(figure.segments.map(s=>s.text).join('|')).not.toContain('SYNTHETIC_FIGURE_BODY');
  expect(figure.coverage.omissions.map(o=>o.code)).not.toContain('MISMATCHED_ENVIRONMENT');
});
