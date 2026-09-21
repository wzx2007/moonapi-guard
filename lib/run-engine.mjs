import {Worker} from 'node:worker_threads';
export function runEngine(inputs,timeoutMs=10000) {
  return new Promise((resolve,reject)=>{
    const worker = new Worker(new URL('./engine-worker.mjs',import.meta.url),{workerData:inputs});
    let settled=false;
    const finish=(error,report)=>{
      if(settled)return;
      settled=true;clearTimeout(timer);void worker.terminate();
      if(error)reject(error);else resolve(report);
    };
    const timer=setTimeout(()=>finish(new Error('Analysis timed out; no compatibility result was produced.')),timeoutMs);
    worker.once('message',result=>finish(result.error?new Error(result.error):null,result.report));
    worker.once('error',error=>finish(error));
    worker.once('exit',code=>{if(!settled)finish(new Error('Analysis worker exited without a result (code '+code+').'));});
  });
}
