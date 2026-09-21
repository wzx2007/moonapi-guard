import {parentPort,workerData} from 'node:worker_threads';
try {
  const {analyze} = await import('../dist/engine.js');
  parentPort.postMessage({report:JSON.parse(analyze(...workerData))});
} catch (error) {
  parentPort.postMessage({error:error.message});
}
