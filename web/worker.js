import {analyze} from './engine.js';
self.onmessage=({data})=>{
 try{self.postMessage({report:JSON.parse(analyze(data.oldText,data.newText))});}
 catch(error){self.postMessage({error:error.message});}
};
