import {spawnSync} from 'node:child_process';
import {mkdirSync, copyFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const result=spawnSync(process.env.MOON ?? 'moon',['build','--target','js','--release'],{cwd:root,stdio:'inherit'});
if(result.error){console.error('MoonBit is required to rebuild. Install it from https://www.moonbitlang.com/download, then retry.');process.exit(2);}
if(result.status!==0)process.exit(result.status??2);
const compiled=['_build/js/release/build/bridge/bridge.js','target/js/release/build/bridge/bridge.js'].map(p=>path.join(root,p)).find(existsSync);
if(!compiled)throw new Error('MoonBit bridge artifact not found');
for(const dir of ['dist','web']){
 mkdirSync(path.join(root,dir),{recursive:true});
 copyFileSync(compiled,path.join(root,dir,'engine.js'));
}
console.log('Built MoonBit engine → dist/engine.js and web/engine.js');
