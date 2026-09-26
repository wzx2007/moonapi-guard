import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {readFileSync} from 'node:fs';
import {runEngine} from '../lib/run-engine.mjs';
const input=readFileSync(new URL('../examples/old.json',import.meta.url),'utf8');
test('already-aborted work rejects without starting analysis',async()=>{
 const c=new AbortController();c.abort();
 await assert.rejects(runEngine([input,input],10000,{signal:c.signal}),{name:'AbortError'});
 assert.equal(getEventListeners(c.signal,'abort').length,0);
});
test('cancellation releases its listener and does not cancel other jobs',async()=>{
 const c=new AbortController();
 const first=runEngine([input,input],10000,{signal:c.signal});
 const second=runEngine([input,input]);c.abort();
 await assert.rejects(first,{name:'AbortError'});
 assert.equal((await second).status,'compatible');
 assert.equal(getEventListeners(c.signal,'abort').length,0);
});
test('successful analysis releases abort listener; late abort is harmless',async()=>{
 const c=new AbortController();const r=await runEngine([input,input],10000,{signal:c.signal});
 assert.equal(r.status,'compatible');assert.equal(getEventListeners(c.signal,'abort').length,0);c.abort();
});
test('worker API validates timeouts and signal before starting a worker',async()=>{
 for(const value of [0,-1,Infinity,NaN,1.5,120001])await assert.rejects(runEngine([input,input],value),RangeError);
 await assert.rejects(runEngine([input,input],10000,{signal:{}}),TypeError);
});
