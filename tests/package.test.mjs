import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildArchive} from '../scripts/package-release.mjs';
test('release is deterministic, includes compiled engines, excludes untracked files and rejects drift',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'moonapi-package-'));
 try {
  assert.equal(spawnSync('git',['init'],{cwd:dir}).status,0);
  writeFileSync(path.join(dir,'package.json'),JSON.stringify({version:'1.2.3'}));
  writeFileSync(path.join(dir,'private.txt'),'DO NOT SHIP');
  for(const folder of ['dist','web']){mkdirSync(path.join(dir,folder));writeFileSync(path.join(dir,folder,'engine.js'),'engine');}
  assert.equal(spawnSync('git',['add','package.json'],{cwd:dir}).status,0);
  const a=buildArchive(dir),b=buildArchive(dir);
  assert.deepEqual(a.bytes,b.bytes);assert.equal(a.filename,'MoonAPI-Guard-v1.2.3.zip');
  assert.match(a.manifest,/dist\/engine.js/);assert.match(a.manifest,/web\/engine.js/);
  assert.ok(!a.bytes.includes(Buffer.from('DO NOT SHIP')));
  writeFileSync(path.join(dir,'web/engine.js'),'stale');
  assert.throws(()=>buildArchive(dir),/engines differ/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
