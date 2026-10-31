import { extname } from 'node:path';
import { Builder, DocumentError, LIMITS, type Format, type Scope, type Document } from './model.js';
import { markdown } from './markdown.js';
import { latex } from './latex.js';
import { docx } from './docx.js';
export { DocumentError, LIMITS, mapFinding, proposeReplacement, revisionOf } from './model.js';
export type { Document, Format, Scope, Location, Unit, Segment, Span, Section, Finding, ErrorCode } from './model.js';

export interface ReadOptions { format?:Format; filename?:string; scope?:Scope }
/** Pure local inspection of supplied content. No filesystem writes, external lookups or tool calls. */
export async function readDocument(input:string|Uint8Array,options:ReadOptions={}):Promise<Document> {
  if(!options||typeof options!=='object')throw new DocumentError('INVALID_INPUT');
  const detected:Record<string,Format>={'.md':'markdown','.markdown':'markdown','.tex':'latex','.docx':'docx'};
  if(options.filename!==undefined&&typeof options.filename!=='string')throw new DocumentError('INVALID_INPUT');
  const format=options.format??detected[extname(options.filename??'').toLowerCase()];
  if(!['markdown','latex','docx'].includes(format))throw new DocumentError('UNSUPPORTED_FORMAT');
  if(typeof input!=='string'&&!(input instanceof Uint8Array))throw new DocumentError('INVALID_INPUT');
  if((typeof input==='string'?input.length:input.byteLength)>(format==='docx'?LIMITS.archive:LIMITS.text))throw new DocumentError('LIMIT_EXCEEDED');
  if(format==='docx'&&typeof input==='string')throw new DocumentError('INVALID_INPUT');
  let text='';
  if(format!=='docx') {
    try {text=typeof input==='string'?input:new TextDecoder('utf-8',{fatal:true}).decode(input);}catch{throw new DocumentError('MALFORMED_DOCUMENT');}
    if(text.length>LIMITS.text||/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text))throw new DocumentError('MALFORMED_DOCUMENT');
  }
  const builder=new Builder(format,input,options.scope);
  try {
    if(format==='markdown')markdown(text,builder);
    else if(format==='latex')latex(text,builder);
    else await docx(input as Uint8Array,builder);
    return builder.finish();
  }catch(error){throw error instanceof DocumentError?error:new DocumentError('EXTRACTION_FAILURE');}
}
