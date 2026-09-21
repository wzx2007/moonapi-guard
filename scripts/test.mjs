// Enumerate explicitly: Windows shells do not expand globs on Node 20.
import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../',import.meta.url));
const files=readdirSync(new URL('../tests/',import.meta.url)).filter(f=>f.endsWith('.test.mjs')).sort().map(f=>'tests/'+f);
const result=spawnSync(process.execPath,['--test',...files],{cwd,stdio:'inherit'});
if(result.error)console.error(result.error.message);
process.exitCode=result.status??2;
