import {realpathSync,statSync,writeFileSync,renameSync,unlinkSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export function protectInputs(output,inputs) {
  let existing;
  try { existing={real:realpathSync(output),stat:statSync(output)}; }
  catch(error) { if(error.code!=='ENOENT')throw error; }
  for(const input of inputs) {
    const inputStat=statSync(input);
    if(path.resolve(output)===path.resolve(input) || (existing && (
      existing.real===realpathSync(input) ||
      (existing.stat.dev===inputStat.dev && existing.stat.ino===inputStat.ino)
    )))throw new Error('Report output must not overwrite an input document.');
  }
}
export function atomicWrite(output,text) {
  const temporary=path.join(path.dirname(path.resolve(output)),'.moonapi-'+randomUUID()+'.tmp');
  try {
    writeFileSync(temporary,text,{flag:'wx'});
    renameSync(temporary,output);
  } finally {
    try { unlinkSync(temporary); } catch(error) { if(error.code!=='ENOENT')throw error; }
  }
}
