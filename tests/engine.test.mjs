import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyze} from '../dist/engine.js';
import {cases,documentWithSchema,base} from './cases.mjs';
const run=(a,b)=>JSON.parse(analyze(JSON.stringify(a),JSON.stringify(b)));
for(const c of cases)test(c.name,()=>{const r=JSON.parse(analyze(c.oldText,c.newText));assert.equal(r.status,c.status,JSON.stringify(r));if(c.rule)assert.ok(r.findings.some(f=>f.rule===c.rule));});
test('bound direction: 200 deterministic generated comparisons',()=>{
 for(let i=0;i<100;i++){
  const oldMin=(i*17)%13-6,newMin=(i*29)%17-8;
  for(const side of ['request','response']){
   const r=run(documentWithSchema({type:'number',minimum:oldMin},side),documentWithSchema({type:'number',minimum:newMin},side));
   const breaking=side==='request'?newMin>oldMin:newMin<oldMin;
   assert.equal(r.status,breaking?'breaking':'compatible',`${side} ${oldMin} → ${newMin}`);
  }
 }
});
test('enum direction: exhaustive nonempty subsets of three values',()=>{
 for(let a=1;a<8;a++)for(let b=1;b<8;b++)for(const side of ['request','response']){
  const values=mask=>['a','b','c'].filter((_,i)=>mask&(1<<i));
  const r=run(documentWithSchema({type:'string',enum:values(a)},side),documentWithSchema({type:'string',enum:values(b)},side));
  const subset=side==='request'?(a&b)===a:(a&b)===b;
  assert.equal(r.status,subset?'compatible':'breaking');
 }
});
test('report order is deterministic and JSON object order irrelevant',()=>{
 const a=documentWithSchema({type:'object',properties:{a:{type:'string'},z:{type:'number'}},additionalProperties:false});
 const b=documentWithSchema({additionalProperties:false,properties:{z:{type:'number'},a:{type:'string'}},type:'object'});
 assert.equal(run(a,b).status,'compatible');assert.equal(analyze(JSON.stringify(a),JSON.stringify(b)),analyze(JSON.stringify(a),JSON.stringify(b)));
});
test('input depth bounded',()=>{const s='['.repeat(100)+'0'+']'.repeat(100);assert.equal(JSON.parse(analyze(s,JSON.stringify(base()))).status,'invalid');});
test('input size bounded',()=>assert.equal(JSON.parse(analyze(' '.repeat(2_000_001),'{}')).status,'invalid'));
test('branching recursive reference graph is bounded',()=>{
 const d=documentWithSchema({$ref:'#/components/schemas/Node'});
 d.components={schemas:{Node:{type:'object',properties:{a:{$ref:'#/components/schemas/Node'},b:{$ref:'#/components/schemas/Node'}}}}};
 const r=run(d,d);assert.equal(r.complete,false);assert.ok(r.findings.some(f=>f.rule==='WORK_LIMIT'));
});
