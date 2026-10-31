import yauzl, { type Entry, type ZipFile } from 'yauzl';
import sax, { type QualifiedTag, type QualifiedAttribute } from 'sax';
import { Builder, DocumentError, LIMITS, type Location, type Range } from './model.js';

const WORD = new Set(['http://schemas.openxmlformats.org/wordprocessingml/2006/main','http://purl.oclc.org/ooxml/wordprocessingml/main']);
const selected = new Set(['[Content_Types].xml','word/document.xml','word/footnotes.xml','word/endnotes.xml',
  'word/_rels/document.xml.rels','docProps/core.xml']);
const utf8 = (data:Uint8Array) => {
  try {return new TextDecoder('utf-8',{fatal:true}).decode(data);} catch {throw new DocumentError('MALFORMED_DOCUMENT');}
};
function parseXml(xml:string, open:(tag:QualifiedTag)=>void, text:(text:string)=>void, close:(tag:QualifiedTag)=>void):void {
  if(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/u.test(xml))throw new DocumentError('MALFORMED_DOCUMENT');
  let depth=0;
  const options={xmlns:true,strictEntities:true,trim:false,normalize:false};
  const parser=sax.parser(true,options);
  parser.ondoctype=()=>{throw new DocumentError('UNSUPPORTED_FEATURE');};
  parser.onerror=()=>{throw new DocumentError('MALFORMED_DOCUMENT');};
  parser.onopentag=tag=>{if(++depth>LIMITS.xmlDepth)throw new DocumentError('LIMIT_EXCEEDED');open(tag as QualifiedTag);};
  parser.ontext=text;parser.oncdata=text;
  const stack:QualifiedTag[]=[];
  const onOpen=parser.onopentag;
  parser.onopentag=tag=>{stack.push(tag as QualifiedTag);onOpen!(tag);};
  parser.onclosetag=()=>{close(stack.pop()!);depth--;};
  try {parser.write(xml).close();} catch(error) {throw error instanceof DocumentError?error:new DocumentError('MALFORMED_DOCUMENT');}
}
function attr(tag:QualifiedTag,name:string):string|undefined {
  return Object.values(tag.attributes).find((a):a is QualifiedAttribute=>typeof a!=='string'&&a.local===name)?.value;
}
async function parts(input:Uint8Array,builder:Builder):Promise<Map<string,string>> {
  return new Promise((resolve,reject)=>{
    let zip:ZipFile|undefined,done=false,count=0,total=0;
    const result=new Map<string,string>(),seen=new Set<string>();
    const fail=(error:unknown)=>{if(done)return;done=true;zip?.close();reject(error instanceof DocumentError?error:new DocumentError('MALFORMED_DOCUMENT'));};
    yauzl.fromBuffer(Buffer.from(input),{lazyEntries:true,validateEntrySizes:true,strictFileNames:true},(error,opened)=>{
      if(error||!opened){fail(error);return;}zip=opened;
      zip.on('error',fail);
      zip.on('end',()=>{if(!done){done=true;resolve(result);zip?.close();}});
      zip.on('entry',(entry:Entry)=>{
        if(done)return;
        const name=entry.fileName;
        if(++count>LIMITS.entries || entry.uncompressedSize>LIMITS.entry || (total+=entry.uncompressedSize)>LIMITS.expanded) {fail(new DocumentError('LIMIT_EXCEEDED'));return;}
        if(name.includes('\\')||name.includes('\0')||name.startsWith('/')||/^[A-Za-z]:/u.test(name)||name.split('/').some(p=>p==='..'||p==='.')||seen.has(name)) {fail(new DocumentError('MALFORMED_DOCUMENT'));return;}
        seen.add(name);
        if(entry.generalPurposeBitFlag&1){fail(new DocumentError('UNSUPPORTED_FEATURE'));return;}
        if(!selected.has(name)) {
          if(!name.endsWith('/'))builder.omit('DOCX_PART_NOT_INSPECTED',builder.location(name,'part'));
          zip!.readEntry();return;
        }
        zip!.openReadStream(entry,(streamError,stream)=>{
          if(streamError||!stream){fail(streamError);return;}
          let bytes=0;const chunks:Buffer[]=[];
          stream.on('error',fail);
          stream.on('data',(chunk:Buffer)=>{
            bytes+=chunk.length;
            if(bytes>LIMITS.entry||bytes>entry.uncompressedSize){stream.destroy();fail(new DocumentError('LIMIT_EXCEEDED'));return;}
            chunks.push(chunk);
          });
          stream.on('end',()=>{
            if(done)return;
            try {if(bytes!==entry.uncompressedSize)throw new DocumentError('MALFORMED_DOCUMENT');result.set(name,utf8(Buffer.concat(chunks)));zip!.readEntry();}
            catch(e){fail(e);}
          });
        });
      });
      zip.readEntry();
    });
  });
}
interface TextPiece {start:number;end:number;location:Location;protected:boolean;styles:Record<string,string|boolean>;hyperlink?:string}
interface Paragraph {text:string;path:string;style?:string;numbering?:{id?:string;level?:string};pieces:TextPiece[];markers:Record<string,unknown>[];run:number;textNode:number}
export async function docx(input:Uint8Array,builder:Builder):Promise<void> {
  const archive=await parts(input,builder);
  if(!archive.has('word/document.xml')||!archive.has('[Content_Types].xml'))throw new DocumentError('MALFORMED_DOCUMENT');
  let mainType=false;
  parseXml(archive.get('[Content_Types].xml')!,tag=>{
    if(tag.local==='Override'&&attr(tag,'PartName')==='/word/document.xml') {
      if(attr(tag,'ContentType')!=='application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml')throw new DocumentError('UNSUPPORTED_FEATURE');
      mainType=true;
    }
  },()=>{},()=>{});
  if(!mainType)throw new DocumentError('MALFORMED_DOCUMENT');
  const relationships:Record<string,{target?:string;external:boolean}> = Object.create(null);
  if(archive.has('word/_rels/document.xml.rels'))parseXml(archive.get('word/_rels/document.xml.rels')!,tag=>{
    if(tag.local==='Relationship')relationships[attr(tag,'Id')??'']={target:attr(tag,'Target'),external:attr(tag,'TargetMode')==='External'};
  },()=>{},()=>{});
  let totalText=0;
  builder.omit('DOCX_STYLE_INHERITANCE_AND_LAYOUT_NOT_RESOLVED');
  for(const part of ['word/document.xml','word/footnotes.xml','word/endnotes.xml']) {
    const xml=archive.get(part);if(!xml)continue;
    let paragraph:Paragraph|undefined,buffer='',inText=false,inInstruction=false,fieldDepth=0,opaque=0,hyperlink:string|undefined;
    let runStyles:Record<string,string|boolean>={};let rootSeen=false;
    const structures:{kind:string;path:string;counters:Record<string,number>}[]=[{kind:'root',path:part==='word/document.xml'?'body':'notes',counters:{}}];
    const push=(kind:string,metadata:Record<string,unknown>={})=>{
      const parent=structures.at(-1)!;const index=parent.counters[kind]=(parent.counters[kind]??0)+1;
      const path=`${parent.path}/${kind}/${index}`;structures.push({kind,path,counters:{}});
      builder.add(kind,'',builder.location(part,path),[],metadata);return path;
    };
    const mark=(kind:string,metadata:Record<string,unknown>={})=>{
      if(paragraph){const start=paragraph.text.length;paragraph.text+='\uFFFC';
        if(++totalText>LIMITS.text)throw new DocumentError('LIMIT_EXCEEDED');
        paragraph.markers.push({kind,start,...metadata});}
    };
    parseXml(xml,tag=>{
      if(!rootSeen){rootSeen=true;const expected=part==='word/document.xml'?'document':part==='word/footnotes.xml'?'footnotes':'endnotes';if(!WORD.has(tag.uri)||tag.local!==expected)throw new DocumentError('MALFORMED_DOCUMENT');}
      if(opaque){opaque++;return;}
      if(!WORD.has(tag.uri)) {
        if(tag.local==='AlternateContent'||tag.local==='oMath'||tag.local==='oMathPara'){opaque=1;mark('unsupported');builder.omit('DOCX_OPAQUE_CONTENT');}
        return;
      }
      const name=tag.local;
      if(['drawing','pict','object','del','ins','moveFrom','moveTo','sdt','altChunk'].includes(name)) {
        opaque=1;mark(name);builder.omit('DOCX_OPAQUE_CONTENT');return;
      }
      if(name==='tblHeader') {
        const row=[...structures].reverse().find(s=>s.kind==='row');
        const unit=row&&builder.document.units.find(u=>u.location.part===part&&u.location.path===row.path);
        if(unit)unit.metadata.tableHeader=!['0','false','off'].includes(attr(tag,'val')??'true');
      }
      if(['tbl','tr','tc','footnote','endnote'].includes(name)) {push(({tbl:'table',tr:'row',tc:'cell'} as Record<string,string>)[name]??name,{noteId:attr(tag,'id')});return;}
      if(name==='p') {
        if(paragraph)throw new DocumentError('UNSUPPORTED_FEATURE');
        const parent=structures.at(-1)!;const index=parent.counters.paragraph=(parent.counters.paragraph??0)+1;
        paragraph={text:'',path:`${parent.path}/paragraph/${index}`,pieces:[],markers:[],run:0,textNode:0};
      }
      if(!paragraph)return;
      if(name==='pStyle')paragraph.style=attr(tag,'val');
      if(name==='numId'||name==='ilvl'){paragraph.numbering??={};paragraph.numbering[name==='numId'?'id':'level']=attr(tag,'val');}
      if(name==='r'){paragraph.run++;paragraph.textNode=0;runStyles={};}
      if(['b','i','vertAlign','rStyle','vanish'].includes(name))runStyles[name]=attr(tag,'val')??true;
      if(name==='hyperlink')hyperlink=attr(tag,'id')??attr(tag,'anchor');
      if(name==='fldSimple'){fieldDepth++;mark('field',{instruction:attr(tag,'instr')});}
      if(name==='fldChar') {
        const kind=attr(tag,'fldCharType');if(kind==='begin'){fieldDepth++;mark('field');}if(kind==='end')fieldDepth=Math.max(0,fieldDepth-1);
      }
      if(name==='instrText'){inInstruction=true;buffer='';}
      if(name==='t'){inText=true;buffer='';paragraph.textNode++;}
      if(['footnoteReference','endnoteReference','commentReference','bookmarkStart','bookmarkEnd'].includes(name))mark(name,{id:attr(tag,'id')});
      if(name==='tab'||name==='br'||name==='cr')mark(name);
    },text=>{
      if(opaque)return;
      if(inText||inInstruction){buffer+=text;if((totalText+=text.length)>LIMITS.text)throw new DocumentError('LIMIT_EXCEEDED');}
    },tag=>{
      if(opaque){opaque--;return;}
      if(!WORD.has(tag.uri))return;
      const name=tag.local;
      if(name==='t'&&paragraph) {
        const start=paragraph.text.length;paragraph.text+=buffer;
        paragraph.pieces.push({start,end:paragraph.text.length,location:{...builder.location(part,paragraph.path),run:paragraph.run,textNode:paragraph.textNode},
          protected:fieldDepth>0||(Boolean(runStyles.vanish)&&!['0','false','off'].includes(String(runStyles.vanish)))||/code/iu.test(String(runStyles.rStyle??'')),styles:{...runStyles},hyperlink});
        inText=false;buffer='';
      }
      if(name==='instrText'){paragraph?.markers.push({kind:'fieldInstruction',text:buffer});inInstruction=false;buffer='';}
      if(name==='fldSimple')fieldDepth=Math.max(0,fieldDepth-1);
      if(name==='hyperlink')hyperlink=undefined;
      if(name==='p'&&paragraph) {
        const p=paragraph;paragraph=undefined;
        const level=/^heading\s*([1-6])$/iu.exec(p.style??'');
        if(level&&part==='word/document.xml')builder.heading(p.text,Number(level[1]));
        const kind=level?'heading':/^caption$/iu.test(p.style??'')?'caption':p.numbering?'listItem':'paragraph';
        const eligible:Range[]=p.pieces.filter(piece=>!piece.protected&&!/^code$/iu.test(p.style??'')).map(({start,end})=>({start,end}));
        const location=builder.location(part,p.path);
        builder.add(kind,p.text,location,eligible,
          {style:p.style,level:level?Number(level[1]):undefined,numbering:p.numbering,
            runs:p.pieces.map(piece=>({start:piece.start,end:piece.end,run:piece.location.run,textNode:piece.location.textNode,styles:piece.styles,
              hyperlink:piece.hyperlink,relationship:piece.hyperlink?relationships[piece.hyperlink]:undefined})),markers:p.markers},
          p.pieces.map(piece=>({...piece,location:{...piece.location,sections:location.sections}})));
      }
      if(['tbl','tr','tc','footnote','endnote'].includes(name))structures.pop();
    });
    if(fieldDepth)builder.omit('DOCX_UNCLOSED_FIELD');
  }
  const metadata=archive.get('docProps/core.xml');
  if(metadata) {
    let field:string|undefined,buffer='';
    parseXml(metadata,tag=>{if(['title','subject','language'].includes(tag.local)){field=tag.local;buffer='';}},text=>{if(field){buffer+=text;if(buffer.length>LIMITS.text)throw new DocumentError('LIMIT_EXCEEDED');}},tag=>{
      if(tag.local===field){builder.add('metadata',buffer,builder.location('docProps/core.xml',field!),[],{field});field=undefined;}
    });
  }
  for(const unit of builder.document.units) {
    for(const marker of (unit.metadata.markers??[]) as {kind:string;id?:string}[]) {
      if(!['footnoteReference','endnoteReference'].includes(marker.kind))continue;
      const kind=marker.kind==='footnoteReference'?'footnote':'endnote';
      if(!builder.document.units.some(u=>u.kind===kind&&u.metadata.noteId===marker.id))builder.omit('NOTE_CONTENT_NOT_AVAILABLE',unit.location);
    }
  }
}
