import { Builder, type Range } from './model.js';

interface Region extends Range { kind:string; name?:string; value?:string; level?:number }
const escaped = (text:string, at:number) => {
  let count=0; while (at > 0 && text[--at] === '\\') count++; return count%2===1;
};
function balanced(text:string, at:number, open='{', close='}'): number {
  let depth=0;
  for (let i=at;i<text.length;i++) {
    if (text[i] === '%' && !escaped(text,i)) { const n=text.indexOf('\n',i); if(n<0)return -1; i=n; continue; }
    if (escaped(text,i)) continue;
    if (text[i] === open) depth++;
    if (text[i] === close && --depth === 0) return i+1;
  }
  return -1;
}
function closingMath(text:string,at:number,delimiter:string):number {
  for(let i=at;i<text.length;i++) {
    if(text[i]==='%'&&!escaped(text,i)){const end=text.indexOf('\n',i);if(end<0)return -1;i=end;continue;}
    if(text.startsWith(delimiter,i)&&!escaped(text,i))return i;
  }
  return -1;
}
function closingEnvironment(text:string,at:number,name:string):number {
  const begin=`\\begin{${name}}`,end=`\\end{${name}}`;
  if(['verbatim','verbatim*','lstlisting','minted'].includes(name)) {
    const i=text.indexOf(end,at);return i<0?-1:i+end.length;
  }
  let depth=1;
  for(let i=at;i<text.length;i++) {
    if(text[i]==='%'&&!escaped(text,i)){const n=text.indexOf('\n',i);if(n<0)return -1;i=n;continue;}
    if(escaped(text,i))continue;
    if(text.startsWith(begin,i)){depth++;i+=begin.length-1;}
    else if(text.startsWith(end,i)){if(--depth===0)return i+end.length;i+=end.length-1;}
  }
  return -1;
}
function trivia(text:string,at:number):number {
  while(at<text.length) {
    if(/\s/u.test(text[at])){at++;continue;}
    if(text[at]==='%'&&!escaped(text,at)){const end=text.indexOf('\n',at);if(end<0)return text.length;at=end;continue;}
    break;
  }
  return at;
}
export function latex(source:string,builder:Builder):void {
  const regions:Region[]=[];
  const headings:Region[]=[];
  const notes:Region[]=[];
  const wrappers=new Set(['emph','textbf','textit','textrm','textsf','texttt','underline']);
  const transparent=new Set(['document','abstract','itemize','enumerate','quote']);
  const protectedRegion=(start:number,end:number,kind:string,name?:string) => regions.push({start,end,kind,name});
  const environments:string[]=[];
  let documentOpened=false;
  let activeStart=0;
  let stoppedForDynamicSyntax=false;
  for(let i=0;i<source.length;) {
    const start=i;
    if(source[i]==='%' && !escaped(source,i)) {
      i=source.indexOf('\n',i);if(i<0)i=source.length; protectedRegion(start,i,'comment');continue;
    }
    if(source[i]==='$' && !escaped(source,i)) {
      const delimiter=source.startsWith('$$',i)?'$$':'$';const end=closingMath(source,i+delimiter.length,delimiter);
      i=end<0?source.length:end+delimiter.length;protectedRegion(start,i,'math');
      if(end<0)builder.omit('UNCLOSED_MATH');continue;
    }
    if(source[i]==='{'||source[i]==='}'||source[i]==='~') {protectedRegion(i,i+1,'groupSyntax');i++;continue;}
    if(source[i]!=='\\') {i++;continue;}
    if(source.startsWith('\\(',i)||source.startsWith('\\[',i)) {
      const close=source[i+1]==='('? '\\)':'\\]'; const end=closingMath(source,i+2,close);
      i=end<0?source.length:end+2;protectedRegion(start,i,'math');if(end<0)builder.omit('UNCLOSED_MATH');continue;
    }
    const command=/^\\([A-Za-z@]+\*?|[^\r\n])/u.exec(source.slice(i));
    if(!command){protectedRegion(i,++i,'command');continue;}
    const name=command[1].replace(/\*$/u,'');i+=command[0].length;
    if(['catcode','csname','def','gdef','edef','xdef','let','futurelet','newcommand','renewcommand',
      'providecommand','DeclareRobustCommand','newenvironment','renewenvironment','NewDocumentCommand',
      'RenewDocumentCommand','ProvideDocumentCommand','DeclareDocumentCommand','newif'].includes(name)||name.startsWith('if')) {
      protectedRegion(start,source.length,'unsupported',name);stoppedForDynamicSyntax=true;builder.omit('DYNAMIC_TEX_NOT_INTERPRETED');break;
    }
    if(name==='verb') {
      const delimiter=source[i];const end=delimiter?source.indexOf(delimiter,i+1):-1;
      i=end<0?source.length:end+1;protectedRegion(start,i,'code');if(end<0)builder.omit('UNCLOSED_VERBATIM');continue;
    }
    i=trivia(source,i);
    if(name==='caption'||name==='footnote'||name==='footnotetext')builder.omit('TEX_NOTE_OR_CAPTION_RETAINED_AS_SOURCE');
    // Optional arguments are always syntax, never submitted as ordinary prose.
    if(source[i]==='[') {
      const end=balanced(source,i,'[',']');if(end<0){protectedRegion(start,source.length,'command');builder.omit('UNCLOSED_COMMAND');break;}i=trivia(source,end);
    }
    if((name==='begin'||name==='end')&&source[i]==='{') {
      const end=balanced(source,i);if(end<0){protectedRegion(start,source.length,'command');builder.omit('UNCLOSED_ENVIRONMENT');break;}
      const env=source.slice(i+1,end-1);i=end;
      if(name==='begin'&&!transparent.has(env)) {
        // Balance same-name environments, without interpreting macros or executing TeX.
        const closing=closingEnvironment(source,end,env);
        i=closing<0?source.length:closing;
        protectedRegion(start,i,/^(equation|align|gather|multline|displaymath|math)\*?$/u.test(env)?'math':'environment',env);
        builder.omit(closing<0?'UNCLOSED_ENVIRONMENT':'PROTECTED_ENVIRONMENT');
      } else {
        protectedRegion(start,i,'command',env);
        if(name==='begin') {
          environments.push(env);
          if(env==='document') {documentOpened=true;activeStart=i;protectedRegion(0,start,'metadata');}
        } else {
          if(environments.pop()!==env)builder.omit('MISMATCHED_ENVIRONMENT');
          if(env==='document'){protectedRegion(i,source.length,'metadata');break;}
        }
      }
      continue;
    }
    const levels:Record<string,number>={section:1,subsection:2,subsubsection:3};
    const level=Object.hasOwn(levels,name)?levels[name]:undefined;
    if(source[i]==='{' && (level||wrappers.has(name))) {
      const end=balanced(source,i);
      if(end<0){protectedRegion(start,source.length,'command');builder.omit('UNCLOSED_COMMAND');break;}
      protectedRegion(start,i+1,'command',name);protectedRegion(end-1,end,'command',name);
      if(level)headings.push({start,end,kind:'heading',value:source.slice(i+1,end-1),level});
      if(name==='texttt')protectedRegion(i+1,end-1,'code');
      i++;continue;
    }
    // Protect unknown commands and all immediately attached balanced arguments.
    let hasArgument=false;
    while(source[i]==='{'||source[i]==='[') {
      const end=balanced(source,i,source[i],source[i]==='{'?'}':']');if(end<0){i=source.length;builder.omit('UNCLOSED_COMMAND');break;}i=trivia(source,end);
      hasArgument=true;
    }
    if(['input','include','bibliography','addbibresource'].includes(name)&&!hasArgument) {
      const line=source.indexOf('\n',i);i=line<0?source.length:line;
    }
    protectedRegion(start,i,/^(?:cite\w*|\w*cite|parencite|textcite|autocite|footcite)$/u.test(name)?'citation':'command',name);
    if(['footnote','footnotetext','caption'].includes(name)&&hasArgument)notes.push({start,end:i,kind:name==='caption'?'caption':'footnote'});
    if(['input','include','bibliography','addbibresource'].includes(name))builder.omit('EXTERNAL_TEX_RESOURCE_NOT_READ');
  }
  if(environments.length)builder.omit(stoppedForDynamicSyntax?'ENVIRONMENT_BALANCE_NOT_ASSESSED':'UNCLOSED_ENVIRONMENT');
  if(!documentOpened)builder.omit('TEX_FRAGMENT_OR_NO_ACTIVE_DOCUMENT');
  const sortedRegions=regions.sort((a,b)=>a.start-b.start);
  const activeHeadings=headings.filter(h=>h.start>=activeStart);
  const all=[...activeHeadings];
  let at=0;
  // Headings form their own units; other text is separated only at source blank lines.
  for(const heading of activeHeadings) {
    if(heading.start>at)paragraphs(at,heading.start);
    at=heading.end;
  }
  if(at<source.length)paragraphs(at,source.length);
  function paragraphs(start:number,end:number) {
    const text=source.slice(start,end);let previous=0;
    for(const match of text.matchAll(/\r?\n[ \t]*\r?\n/gu)) {
      if(match.index>previous)all.push({start:start+previous,end:start+match.index,kind:'paragraph'});
      previous=match.index+match[0].length;
    }
    if(previous<text.length)all.push({start:start+previous,end,kind:'paragraph'});
  }
  let regionIndex=0;
  for(const block of all.sort((a,b)=>a.start-b.start)) {
    if(!source.slice(block.start,block.end).trim())continue;
    if(block.level)builder.heading(block.value!,block.level);
    while(regionIndex<sortedRegions.length&&sortedRegions[regionIndex].end<=block.start)regionIndex++;
    const protectedSpans:Region[]=[];
    for(let n=regionIndex;n<sortedRegions.length&&sortedRegions[n].start<block.end;n++)if(sortedRegions[n].end>block.start)protectedSpans.push(sortedRegions[n]);
    const eligible:Range[]=[];let cursor=block.start;
    for(const region of protectedSpans) {
      if(region.start>cursor)eligible.push({start:cursor-block.start,end:Math.min(region.start,block.end)-block.start});
      cursor=Math.max(cursor,region.end);
    }
    if(cursor<block.end)eligible.push({start:cursor-block.start,end:block.end-block.start});
    builder.add(block.kind,source.slice(block.start,block.end),builder.location('source',`block/${builder.document.units.length+1}`,block.start,block.end),eligible,
      {level:block.level,markers:protectedSpans.map(r=>({kind:r.kind,name:r.name,start:Math.max(r.start,block.start)-block.start,end:Math.min(r.end,block.end)-block.start}))});
    // The raw source is retained for citation keys, labels and protected material inspection.
  }
  for(const note of notes)builder.add(note.kind,source.slice(note.start,note.end),
    {...builder.location('source',`${note.kind}/${note.start}`,note.start,note.end),
      sections:builder.document.units.find(u=>u.location.start!<=note.start&&u.location.end!>=note.end)?.location.sections??[]},[],{readOnly:true});
}
