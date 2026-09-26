import {test} from 'node:test';
import assert from 'node:assert/strict';
import {textReport,markdownReport} from '../lib/render.mjs';
const report=message=>({version:'0.2.0',status:'breaking',complete:true,breaking_count:1,warning_count:0,errors:[],findings:[{severity:'breaking',rule:'X',operation:'GET /orders',location:'/paths',message}]});
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
