import {Worker} from 'node:worker_threads';
export function runEngine(inputs,timeoutMs=10000,{signal}={}) {
  return new Promise((resolve,reject)=>{
    if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>120000)throw new RangeError('Timeout must be between 1 and 120000 ms.');
    if(signal!==undefined && !(signal instanceof AbortSignal))throw new TypeError('signal must be an AbortSignal.');
    const aborted=()=>new DOMException('Analysis cancelled; no compatibility result was produced.','AbortError');
    if(signal?.aborted){reject(aborted());return;}
    const worker = new Worker(new URL('./engine-worker.mjs',import.meta.url),{workerData:inputs});
    let settled=false;
    const finish=(error,report)=>{
      if(settled)return;
      settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);void worker.terminate();
      if(error)reject(error);else resolve(report);
    };
    const timer=setTimeout(()=>finish(new Error('Analysis timed out; no compatibility result was produced.')),timeoutMs);
    const cancel=()=>finish(aborted());
    signal?.addEventListener('abort',cancel,{once:true});
    worker.once('message',result=>finish(result.error?new Error(result.error):null,result.report));
    worker.once('error',error=>finish(error));
    worker.once('exit',code=>{if(!settled)finish(new Error('Analysis worker exited without a result (code '+code+').'));});
  });
}
