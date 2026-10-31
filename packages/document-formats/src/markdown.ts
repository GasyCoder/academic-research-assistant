import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';
import { Builder, type Range } from './model.js';

interface Node {
  type: string; value?: string; depth?: number; identifier?: string; url?: string; ordered?: boolean;
  children?: Node[]; position?: {start:{offset?:number};end:{offset?:number}};
}
export function markdown(source: string, builder: Builder): void {
  let base = source.startsWith('\uFEFF')?1:0;
  const opening=/^---\r?\n/u.exec(source.slice(base));
  if (opening) {
    const contentStart=base+opening[0].length;
    const closing=/^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/mu.exec(source.slice(contentStart));
    base = closing?contentStart+closing.index+closing[0].length:source.length;
    builder.add('metadata',source.slice(0,base),builder.location('source','frontmatter',0,base));
    if (!closing) builder.omit('UNCLOSED_FRONTMATTER');
  } else if(base)builder.add('metadata',source.slice(0,base),builder.location('source','bom',0,base));
  const tree = fromMarkdown(source.slice(base),{extensions:[gfm()],mdastExtensions:[gfmFromMarkdown()]}) as Node;
  const leaves = (node: Node, offset: number): Range[] => {
    const result:Range[]=[],pending=[{node,depth:0}];
    while(pending.length){
      const {node:current,depth}=pending.pop()!;
      if(depth>256){builder.omit('MARKDOWN_NESTING_LIMIT');return [];}
      const start=base+(current.position?.start.offset??0),end=base+(current.position?.end.offset??0);
      if(current.type==='text'){
        // Decoded entities/escapes are not one-to-one source ranges: keep them protected.
        if(source.slice(start,end)!==current.value)builder.omit('ENCODED_MARKDOWN_TEXT');
        else result.push({start:start-offset,end:end-offset});
      }else if(['emphasis','strong','delete','paragraph','heading','link','linkReference','tableCell'].includes(current.type)){
        for(let i=(current.children?.length??0)-1;i>=0;i--)pending.push({node:current.children![i],depth:depth+1});
      }
    }
    return result;
  };
  const stack: {node:Node;path:string;depth:number;tableHeader?:boolean}[] = [{node:tree,path:'document',depth:0}];
  while (stack.length) {
    const {node,path,depth,tableHeader} = stack.pop()!;
    if (depth > 256) {builder.omit('MARKDOWN_NESTING_LIMIT'); continue;}
    const start = base+(node.position?.start.offset ?? 0), end = base+(node.position?.end.offset ?? 0);
    if (node.type === 'heading') builder.heading(source.slice(start,end).replace(/^#{1,6}\s*/u,'').replace(/\r?\n[=-]+\s*$/u,''),node.depth!);
    const location = builder.location('source',path,start,end);
    const prose = ['heading','paragraph','tableCell'].includes(node.type);
    const contains = (type:string):boolean => {
      const pending=[...(node.children??[])];
      while(pending.length){const child=pending.pop()!;if(child.type===type)return true;pending.push(...(child.children??[]));}
      return false;
    };
    if(prose&&contains('html'))builder.omit('RAW_HTML_NOT_REVIEWED',location);
    const container = ['root','list','listItem','blockquote','table','tableRow','footnoteDefinition'].includes(node.type);
    if (node.type !== 'root') builder.add(node.type,container?'':source.slice(start,end),location,
      prose&&!contains('html')?leaves(node,start):[],{level:node.depth,identifier:node.identifier,url:node.url,ordered:node.ordered,tableHeader});
    if (node.type === 'image' || node.type === 'imageReference') builder.omit('IMAGE_CONTENT_NOT_REVIEWED',location);
    if (node.type === 'html') builder.omit('RAW_HTML_NOT_REVIEWED',location);
    if (node.type === 'footnoteDefinition' || node.type === 'footnoteReference') {
      if (node.type === 'footnoteReference') continue;
    }
    if (container) for (let i=(node.children?.length ?? 0)-1;i>=0;i--)
      stack.push({node:node.children![i],path:`${path}/${node.type === 'root'?'block':node.type}/${i+1}`,depth:depth+1,
        tableHeader:node.type === 'table'?i===0:tableHeader});
    // Inline nodes are represented by the paragraph's raw text and protected complement.
    if (prose && (contains('image')||contains('imageReference'))) builder.omit('IMAGE_CONTENT_NOT_REVIEWED',location);
  }
}
