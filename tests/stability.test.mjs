import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,linkSync,rmSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {AnalysisController} from '../web/analysis-controller.js';
import {sarifReport,markdownReport} from '../lib/render.mjs';
const cwd=fileURLToPath(new URL('../',import.meta.url));
const run=(...args)=>spawnSync(process.execPath,['bin/moonapi-guard.mjs',...args],{cwd,encoding:'utf8'});
const inputs=['examples/old.json','examples/breaking.json'];
test('report output cannot overwrite input or its hardlink',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'guard-safe-'));
 try{
  const source=path.join(dir,'input.json'),alias=path.join(dir,'alias.json');
  const original=readFileSync(path.join(cwd,'examples/old.json'));
  writeFileSync(source,original);linkSync(source,alias);
  for(const output of [source,alias]){
   const r=run(source,'examples/breaking.json','--output',output);
   assert.equal(r.status,2);assert.match(r.stderr,/overwrite/);assert.deepEqual(readFileSync(source),original);
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('atomic report replacement leaves no temporary files',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'guard-atomic-'));
 try{const out=path.join(dir,'report.json');writeFileSync(out,'old');assert.equal(run(...inputs,'--output',out,'--format','json').status,1);assert.equal(JSON.parse(readFileSync(out,'utf8')).status,'breaking');assert.deepEqual(readdirSync(dir),['report.json']);}
 finally{rmSync(dir,{recursive:true,force:true});}
});
test('invalid UTF-8 rejected without producing report',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'guard-utf8-'));
 try{const input=path.join(dir,'bad.json');writeFileSync(input,Buffer.from([0xff]));assert.equal(run(input,'examples/old.json').status,2);}
 finally{rmSync(dir,{recursive:true,force:true});}
});
test('CLI timeout exits 2 even with report-only policy',()=>{const r=run(...inputs,'--timeout-ms','1','--fail-on','none');assert.equal(r.status,2);assert.match(r.stderr,/timed out/);assert.equal(r.stdout,'');});
test('CLI rejects invalid timeout and duplicate options',()=>{for(const n of ['0','120001','1.5','NaN'])assert.equal(run(...inputs,'--timeout-ms',n).status,2);assert.equal(run(...inputs,'--format','json','--format','html').status,2);});
test('CLI SARIF has rule indexes, logical locations and analysis status',()=>{
 const r=run(...inputs,'--format','sarif');assert.equal(r.status,1);
 const s=JSON.parse(r.stdout);assert.equal(s.version,'2.1.0');const runResult=s.runs[0];assert.equal(runResult.results.length,7);
 for(const f of runResult.results){assert.equal(runResult.tool.driver.rules[f.ruleIndex].id,f.ruleId);assert.ok(f.locations[0].logicalLocations[0].fullyQualifiedName);}
 assert.equal(runResult.properties.complete,true);
});
test('SARIF invalid analysis is a failed invocation',()=>{const r=sarifReport({version:'0.2.0',status:'invalid',complete:false,findings:[],errors:['bad JSON']});assert.equal(r.runs[0].invocations[0].executionSuccessful,false);assert.equal(r.runs[0].invocations[0].toolExecutionNotifications[0].level,'error');});
test('Markdown cannot embed raw HTML from document strings',()=>{
 const r=markdownReport({status:'invalid',complete:false,breaking_count:0,warning_count:0,findings:[],errors:['<script>alert(1)</script>']});
 assert.ok(!r.includes('<script>'));assert.ok(r.includes('&lt;script&gt;'));
});
function fake(){
 const workers=[];
 const controller=new AnalysisController(()=>{const w={terminated:false,postMessage(data){this.input=data;},terminate(){this.terminated=true;}};workers.push(w);return w;},100);
 return {controller,workers};
}
test('browser cancellation terminates worker and rejects pending result',async()=>{const {controller,workers}=fake();const pending=controller.analyze('a','b');const check=assert.rejects(pending,{name:'AbortError'});controller.cancel();await check;assert.equal(workers[0].terminated,true);});
test('browser ignores stale result when a new analysis starts',async()=>{
 const {controller,workers}=fake();const first=controller.analyze('old','old');const check=assert.rejects(first,{name:'AbortError'});
 const second=controller.analyze('a','b');await check;
 workers[0].onmessage({data:{report:{status:'stale'}}});workers[1].onmessage({data:{report:{status:'fresh'}}});
 assert.equal((await second).status,'fresh');assert.equal(workers[1].terminated,true);
});
test('browser worker timeout rejects and terminates',async()=>{const {controller,workers}=fake();controller.timeoutMs=5;await assert.rejects(controller.analyze('a','b'),/超时/);assert.equal(workers[0].terminated,true);});
test('browser worker crash and transport errors are handled',async()=>{const {controller,workers}=fake();const p=controller.analyze('a','b');workers[0].onerror();await assert.rejects(p,/启动失败/);assert.equal(controller.active,null);});
