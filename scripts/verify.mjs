import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readdirSync} from 'node:fs';
const cwd=fileURLToPath(new URL('../',import.meta.url));
const moon=process.env.MOON??'moon';
const tests=readdirSync(new URL('../tests/',import.meta.url)).filter(f=>f.endsWith('.test.mjs')).sort().map(f=>'tests/'+f);
for(const [cmd,args] of [[moon,['check','--deny-warn']],[moon,['test','--target','wasm-gc']],[moon,['test','--target','js']],[process.execPath,['scripts/build.mjs']],[process.execPath,['--test',...tests]]]){
 const r=spawnSync(cmd,args,{cwd,stdio:'inherit'});
 if(r.error||r.status!==0){console.error(r.error??`Verification failed: ${cmd} ${args.join(' ')}`);process.exit(r.status||2);}
}
