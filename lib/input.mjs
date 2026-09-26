import {openSync,fstatSync,readSync,closeSync} from 'node:fs';

// Read through one descriptor, including one sentinel byte to detect growth.
// This bounds allocation even when a file changes after its initial stat.
export function readDocument(file,maxBytes=8_000_000) {
 if(!Number.isSafeInteger(maxBytes)||maxBytes<0||maxBytes>8_000_000)throw Error('Invalid input byte limit.');
 const fd=openSync(file,'r');
 try {
  const stat=fstatSync(fd);
  if(!stat.isFile())throw Error('Input must be a regular file: '+file);
  if(stat.size>maxBytes)throw Error('Input too large: '+file);
  const buffer=Buffer.alloc(maxBytes+1);
  let used=0;
  while(used<buffer.length) {
   const count=readSync(fd,buffer,used,buffer.length-used,null);
   if(count===0)break;
   used+=count;
  }
  if(used>maxBytes)throw Error('Input too large: '+file);
  return new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,used)).replace(/^\uFEFF/,'');
 } finally { closeSync(fd); }
}
