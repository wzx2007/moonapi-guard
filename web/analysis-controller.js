// Worker lifecycle is independent from the UI so cancellation/races can be tested.
export class AnalysisController {
 constructor(createWorker,timeoutMs=10000){this.createWorker=createWorker;this.timeoutMs=timeoutMs;this.active=null;}
 cancel(){
  if(!this.active)return;
  const error=new Error('Analysis cancelled');error.name='AbortError';
  this.active(error);
 }
 analyze(oldText,newText){
  this.cancel();
  return new Promise((resolve,reject)=>{
   const worker=this.createWorker();
   let settled=false,timer;
   const finish=(error,report)=>{
    if(settled)return;
    settled=true;clearTimeout(timer);worker.terminate();
    if(this.active===finish)this.active=null;
    if(error)reject(error);else resolve(report);
   };
   this.active=finish;
   timer=setTimeout(()=>finish(new Error('分析超时，请缩小输入后重试。')),this.timeoutMs);
   worker.onmessage=({data})=>finish(data.error?new Error(data.error):null,data.report);
   worker.onerror=()=>finish(new Error('分析引擎启动失败或异常，请重新构建后刷新。'));
   worker.onmessageerror=()=>finish(new Error('分析结果无法读取。'));
   try{worker.postMessage({oldText,newText});}catch(error){finish(error);}
  });
 }
}
