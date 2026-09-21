import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {htmlReport,markdownReport} from '../lib/render.mjs';
const cwd=fileURLToPath(new URL('../',import.meta.url));
const run=(...args)=>spawnSync(process.execPath,['bin/moonapi-guard.mjs',...args],{cwd,encoding:'utf8'});
const inputs=['examples/old.json','examples/breaking.json'];
test('CLI emits machine-readable report and exit 1',()=>{const r=run(...inputs,'--format','json');assert.equal(r.status,1);const report=JSON.parse(r.stdout);assert.equal(report.breaking_count,7);assert.equal(report.complete,true);assert.equal(r.stderr,'');});
test('compatible fixture exits 0',()=>assert.equal(run('examples/old.json','examples/compatible.json').status,0));
test('incomplete fixture exits 3 by default',()=>assert.equal(run('examples/old.json','examples/review.json').status,3));
test('explicit breaking-only policy permits review findings',()=>assert.equal(run('examples/old.json','examples/review.json','--fail-on','breaking').status,0));
test('report-only policy permits breaking changes',()=>assert.equal(run(...inputs,'--fail-on','none').status,0));
test('unknown option rejected',()=>assert.equal(run(...inputs,'--foramt','json').status,2));
test('missing option value rejected',()=>assert.equal(run(...inputs,'--format').status,2));
test('invalid format rejected',()=>assert.equal(run(...inputs,'--format','yaml').status,2));
test('invalid policy rejected',()=>assert.equal(run(...inputs,'--fail-on','everything').status,2));
test('missing input rejected',()=>assert.equal(run('examples/old.json').status,2));
test('missing file rejected',()=>assert.equal(run('missing.json','examples/old.json').status,2));
test('help and version',()=>{assert.equal(run('--help').status,0);assert.match(run('--help').stdout,/Exit codes/);assert.equal(run('--version').stdout.trim(),'0.2.0');});
test('write report, invalid inputs, BOM, paths with spaces',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'moonapi-test-'));
 try{
  const out=path.join(dir,'report file.html');const r=run(...inputs,'--format','html','--output',out);assert.equal(r.status,1);assert.match(readFileSync(out,'utf8'),/<!doctype html>/);assert.equal(r.stdout,'');
  const bad=path.join(dir,'bad.json');writeFileSync(bad,'{');assert.equal(run(bad,'examples/old.json','--fail-on','none').status,2);
  const bom=path.join(dir,'bom.json');writeFileSync(bom,'\ufeff'+readFileSync(path.join(cwd,'examples/old.json'),'utf8'));assert.equal(run(bom,'examples/old.json').status,0);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('HTML reports escape hostile document strings',()=>{
 const r={version:'0.1.0',status:'breaking',complete:true,breaking_count:1,warning_count:0,errors:['<script>bad()</script>'],findings:[{severity:'breaking',rule:'X',operation:'<img src=x onerror=alert(1)>',location:'/x',message:'<script>bad()</script>'}]};
 const html=htmlReport(r);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(markdownReport(r).includes('| Severity |'));
});
