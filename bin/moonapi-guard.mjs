#!/usr/bin/env node
import {readDocument} from '../lib/input.mjs';
import {textReport,markdownReport,htmlReport,sarifReport} from '../lib/render.mjs';
import {protectInputs,atomicWrite} from '../lib/output.mjs';
import {runEngine} from '../lib/run-engine.mjs';
const VERSION='0.2.0';
const HELP=`MoonAPI Guard — OpenAPI 3.0 compatibility checks powered by MoonBit

Usage: node bin/moonapi-guard.mjs OLD.json NEW.json [options]

  --format text|json|markdown|html|sarif  Report format (default: text)
  --output FILE                         Write report atomically
  --fail-on breaking|warning|none        CI policy (default: warning)
  --timeout-ms N                        Analysis timeout, 1–120000 (default: 10000)
  --help                               Show this help
  --version                            Print version

Exit codes: 0 policy passed; 1 breaking change; 2 invalid input/usage/I/O/timeout;
            3 incomplete analysis (default policy blocks warnings).
No network access. UTF-8 JSON only. Output cannot overwrite either input.
`;
function fail(message){console.error('MoonAPI Guard: '+message);process.exitCode=2;}
process.stdout.on('error',error=>{if(error.code==='EPIPE')process.exit(0);else fail(error.message);});
async function main(){
 const args=process.argv.slice(2);
 if(args.includes('--help')){console.log(HELP);return;}
 if(args.includes('--version')){console.log(VERSION);return;}
 const files=[];let format='text',output,policy='warning',timeoutMs=10000;
 const seen=new Set();
 for(let i=0;i<args.length;i++){
  const option=args[i];
  if(['--format','--output','--fail-on','--timeout-ms'].includes(option)){
   if(seen.has(option))throw Error('Duplicate option: '+option);
   seen.add(option);
   const value=args[++i];
   if(!value||value.startsWith('--'))throw Error('Missing value for '+option);
   if(option==='--format')format=value;
   else if(option==='--output')output=value;
   else if(option==='--fail-on')policy=value;
   else {
    if(!/^[0-9]+$/.test(value))throw Error('Timeout must be an integer.');
    timeoutMs=Number(value);
    if(timeoutMs<1||timeoutMs>120000)throw Error('Timeout must be between 1 and 120000 ms.');
   }
  }else if(option.startsWith('-'))throw Error('Unknown option: '+option);
  else files.push(option);
 }
 if(files.length!==2)throw Error('Provide OLD.json and NEW.json. Use --help for usage.');
 if(!['text','json','markdown','html','sarif'].includes(format))throw Error('Unknown report format.');
 if(!['breaking','warning','none'].includes(policy))throw Error('Unknown --fail-on policy.');
 if(output)protectInputs(output,files);
 const inputs=files.map(file=>readDocument(file));
 const report=await runEngine(inputs,timeoutMs);
 const rendered=format==='json'?JSON.stringify(report,null,2):
  format==='sarif'?JSON.stringify(sarifReport(report),null,2):
  format==='html'?htmlReport(report):format==='markdown'?markdownReport(report):textReport(report);
 if(output){protectInputs(output,files);atomicWrite(output,rendered+'\n');console.error('Report written to '+output);}
 else process.stdout.write(rendered+'\n');
 process.exitCode=report.status==='invalid'?2:policy==='none'?0:
  report.breaking_count?1:policy==='warning'&&!report.complete?3:0;
}
main().catch(error=>fail(error.message));
