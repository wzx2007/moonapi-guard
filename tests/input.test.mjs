import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {readDocument} from '../lib/input.mjs';

test('bounded input reader handles byte limits, BOM and malformed UTF-8',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'moonapi-input-'));
 try {
  const file=path.join(dir,'input.json');
  writeFileSync(file,'你好');
  assert.equal(readDocument(file,6),'你好');
  assert.throws(()=>readDocument(file,5),/too large/);
  writeFileSync(file,'\ufeff{}');assert.equal(readDocument(file,5),'{}');
  writeFileSync(file,Buffer.from([0xc3,0x28]));assert.throws(()=>readDocument(file),/encoded data/);
  // Windows rejects rename while a handle is held without suitable sharing;
  // this also checks that error paths release the file descriptor.
  renameSync(file,path.join(dir,'renamed.json'));
  assert.throws(()=>readDocument(dir),/regular file|EISDIR/);
  assert.throws(()=>readDocument(file,-1),/byte limit/);
 } finally {rmSync(dir,{recursive:true,force:true});}
});
