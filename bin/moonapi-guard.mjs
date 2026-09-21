#!/usr/bin/env node
import {readFileSync,writeFileSync,statSync} from 'node:fs';
import {textReport,markdownReport,htmlReport} from '../lib/render.mjs';
const HELP=`MoonAPI Guard — OpenAPI 3.0 compatibility checks powered by MoonBit

Usage: node bin/moonapi-guard.mjs OLD.json NEW.json [options]

  --format text|json|markdown|html   Report format (default: text)
  --output FILE                    Write report to a file
  --fail-on breaking|warning|none   CI policy (default: warning)
  --help                           Show this help
  --version                        Print version

Exit codes: 0 policy passed; 1 breaking change; 2 invalid input/usage/I/O;
            3 incomplete analysis (default policy blocks warnings).
No API calls or network access are made. YAML is not supported.
`;
function fail(message){console.error(`MoonAPI Guard: ${message}`);process.exit(2);}
const args=process.argv.slice(2);
if(args.includes('--help')){console.log(HELP);process.exit(0);}
if(args.includes('--version')){console.log('0.1.0');process.exit(0);}
const files=[];let format='text',output,policy='warning';
for(let i=0;i<args.length;i++){
 const a=args[i];
 if(['--format','--output','--fail-on'].includes(a)){
  const v=args[++i];if(!v||v.startsWith('--'))fail(`Missing value for ${a}`);
  if(a==='--format')format=v;else if(a==='--output')output=v;else policy=v;
 }else if(a.startsWith('-'))fail(`Unknown option: ${a}`);else files.push(a);
}
if(files.length!==2)fail('Provide OLD.json and NEW.json. Use --help for usage.');
if(!['text','json','markdown','html'].includes(format))fail('Unknown report format.');
if(!['breaking','warning','none'].includes(policy))fail('Unknown --fail-on policy.');
try{
 let analyze;
 try{({analyze}=await import('../dist/engine.js'));}catch{fail('Engine not built. Run npm run build with the MoonBit toolchain installed.');}
 const input=files.map(file=>{if(statSync(file).size>8_000_000)throw new Error(`Input too large: ${file}`);return readFileSync(file,'utf8').replace(/^\uFEFF/,'');});
 const report=JSON.parse(analyze(...input));
 const rendered=format==='json'?JSON.stringify(report,null,2):format==='html'?htmlReport(report):format==='markdown'?markdownReport(report):textReport(report);
 if(output){writeFileSync(output,rendered+'\n');console.error(`Report written to ${output}`);}else process.stdout.write(rendered+'\n');
 process.exitCode=report.status==='invalid'?2:policy==='none'?0:report.breaking_count?1:policy==='warning'&&!report.complete?3:0;
}catch(e){fail(e.message);}
