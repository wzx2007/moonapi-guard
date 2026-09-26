import {test} from 'node:test';
import assert from 'node:assert/strict';
import {textReport,markdownReport,csvReport} from '../lib/render.mjs';
const report=message=>({version:'0.2.0',status:'breaking',complete:true,breaking_count:1,warning_count:0,errors:[],findings:[{severity:'breaking',rule:'X',operation:'GET /orders',location:'/paths',message}]});
test('CSV preserves quotes, commas and newlines and neutralizes formulas',()=>{
 const result=csvReport(report('a,"b"\nc'));
 assert.ok(result.endsWith('"a,""b""\nc"'));
 for(const input of ['=1+1',' +SUM(A1)','-1+2','@SUM(A1)','\t=2']){
  assert.ok(csvReport(report(input)).endsWith('"\''+input+'"'));
 }
});
test('CSV retains summary and errors even when no findings exist',()=>{
 const r=report('');r.status='invalid';r.complete=false;r.findings=[];r.errors=['Bad JSON'];
 const lines=csvReport(r).split('\r\n');assert.equal(lines.length,3);
 assert.match(lines[1],/^"summary","invalid","false"/);
 assert.match(lines[2],/^"error","invalid","false","error"/);
});
test('Markdown renders hostile table content as literal text',()=>{
 const result=markdownReport(report('![image](https://example.com) \\| **bold** `code`\r\n<script>'));
 const row=result.split('\n').find(line=>line.startsWith('| breaking'));
 assert.equal(row.split('|').length,7);
 assert.ok(!row.includes('![image]'));
 assert.ok(!row.includes('**bold**'));
 assert.ok(row.includes('&#92;&#124;'));
 assert.ok(row.includes('&lt;script&gt;'));
});
test('text report escapes terminal controls and forged lines',()=>{
 const r=report('\x1b[2J\r\n[COMPATIBLE]\u202e');r.errors=['\x07'];
 const result=textReport(r);
 assert.ok(!result.includes('\x1b'));
 assert.ok(!result.includes('\r'));
 assert.ok(!result.includes('\u202e'));
 assert.ok(result.includes('\\u001b[2J\\u000d\\u000a[COMPATIBLE]\\u202e'));
 assert.ok(result.includes('ERROR: \\u0007'));
});
