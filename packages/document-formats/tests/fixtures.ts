import { deflateRawSync } from 'node:zlib';
// Entirely synthetic in-memory packages; this is a test fixture writer, not a document writer.
export function zip(entries:{name:string;data:string|Buffer;declaredSize?:number;deflate?:boolean;flags?:number}[]):Buffer {
  const local:Buffer[]=[],central:Buffer[]=[];let offset=0;
  for(const entry of entries) {
    const name=Buffer.from(entry.name),data=Buffer.from(entry.data),stored=entry.deflate?deflateRawSync(data):data;
    let crc=0xffffffff;for(const byte of data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
    const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(entry.flags??0x800,6);
    header.writeUInt16LE(entry.deflate?8:0,8);header.writeUInt32LE(crc,14);header.writeUInt32LE(stored.length,18);
    header.writeUInt32LE(entry.declaredSize??data.length,22);header.writeUInt16LE(name.length,26);
    const directory=Buffer.alloc(46);directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);
    header.copy(directory,8,6,28);directory.writeUInt32LE(offset,42);
    local.push(header,name,stored);central.push(directory,name);offset+=header.length+name.length+stored.length;
  }
  const catalog=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);
  end.writeUInt32LE(catalog.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,catalog,end]);
}
export const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
export const types='<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
export const body=(text:string)=>`<w:document xmlns:w="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${text}</w:body></w:document>`;
export const p=(text:string)=>`<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
export const docx=(xml:string,extra:{name:string;data:string|Buffer;declaredSize?:number;deflate?:boolean;flags?:number}[]=[])=>zip([
  {name:'[Content_Types].xml',data:types},{name:'word/document.xml',data:xml},...extra]);
