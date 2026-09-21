import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('demo server serves worker, restricts paths/methods and supports HEAD',async()=>{
 const child=spawn(process.execPath,['scripts/serve.mjs'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
 try{
  const url=await new Promise((resolve,reject)=>{
   let output='';const timer=setTimeout(()=>reject(Error('Server startup timed out')),5000);
   child.once('error',e=>{clearTimeout(timer);reject(e);});
   child.stdout.on('data',data=>{output+=data;const match=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});
   child.once('exit',code=>{clearTimeout(timer);reject(Error('Server exited '+code));});
  });
  const page=await fetch(url);assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/worker-src 'self'/);
  assert.equal((await fetch(url+'/worker.js')).status,200);
  assert.equal((await fetch(url+'/analysis-controller.js')).status,200);
  assert.equal((await fetch(url+'/.git/config')).status,404);
  assert.equal((await fetch(url,{method:'POST'})).status,405);
  const head=await fetch(url,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
 }finally{child.kill();}
});
