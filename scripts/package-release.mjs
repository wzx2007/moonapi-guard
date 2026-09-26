import {spawnSync} from 'node:child_process';
import {readFileSync,lstatSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function crc32(bytes){
 let crc=0xffffffff;
 for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
 return (crc^0xffffffff)>>>0;
}
// ZIP's stored method needs no third-party runtime. Fixed timestamps and
// lexicographic order make identical source bytes produce identical archives.
function zip(entries){
 const local=[],central=[];let offset=0;
 for(const [name,data] of entries){
  const filename=Buffer.from('moonapi-guard/'+name);const crc=crc32(data);
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);
  h.writeUInt16LE(0x800,6);h.writeUInt16LE(0x2821,12);h.writeUInt32LE(crc,14);
  h.writeUInt32LE(data.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(filename.length,26);
  local.push(h,filename,data);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);
  c.writeUInt16LE(0x800,8);c.writeUInt16LE(0x2821,14);c.writeUInt32LE(crc,16);
  c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(filename.length,28);c.writeUInt32LE(offset,42);
  central.push(c,filename);offset+=h.length+filename.length+data.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);
 end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,directory,end]);
}
export function buildArchive(root){
 const result=spawnSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'});
 if(result.error||result.status!==0)throw Error('Packaging requires a Git checkout.');
 const names=[...new Set([...result.stdout.split('\0').filter(Boolean),'dist/engine.js','web/engine.js'])].sort();
 const entries=names.map(name=>{
  if(name.startsWith('/')||name.includes('\\')||name.split('/').some(p=>p==='..'||p==='.git'))throw Error('Unsafe release path: '+name);
  const file=path.join(root,name);
  if(!lstatSync(file).isFile())throw Error('Release entries must be regular files: '+name);
  return [name,readFileSync(file)];
 });
 const lookup=new Map(entries);
 if(!lookup.get('dist/engine.js').equals(lookup.get('web/engine.js')))throw Error('Compiled engines differ; run npm run build.');
 const version=JSON.parse(lookup.get('package.json')).version;
 if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Invalid release version.');
 const manifest=entries.map(([name,data])=>hash(data)+'  '+name).join('\n')+'\n';
 entries.push(['MANIFEST.sha256',Buffer.from(manifest)]);entries.sort(([a],[b])=>a<b?-1:a>b?1:0);
 const bytes=zip(entries);
 return {filename:`MoonAPI-Guard-v${version}.zip`,bytes,sha256:hash(bytes),manifest};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const root=fileURLToPath(new URL('../',import.meta.url));
  const output=path.resolve(process.argv[2]??path.join(root,'release'));
  const archive=buildArchive(root);mkdirSync(output,{recursive:true});
  writeFileSync(path.join(output,archive.filename),archive.bytes,{flag:'wx'});
  writeFileSync(path.join(output,archive.filename+'.sha256'),archive.sha256+'  '+archive.filename+'\n',{flag:'wx'});
  console.log(path.join(output,archive.filename));
 }catch(error){console.error(error.message);process.exitCode=2;}
}
