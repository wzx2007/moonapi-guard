import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../',import.meta.url));
const moon=process.env.MOON??'moon';
for(const [cmd,args] of [[moon,['check','--deny-warn']],[moon,['test','--target','wasm-gc']],[moon,['test','--target','js']],[process.execPath,['scripts/build.mjs']],[process.execPath,['--test','tests/engine.test.mjs','tests/cli.test.mjs']]]){
 const r=spawnSync(cmd,args,{cwd,stdio:'inherit'});
 if(r.error||r.status!==0){console.error(r.error??`Verification failed: ${cmd} ${args.join(' ')}`);process.exit(r.status||2);}
}
