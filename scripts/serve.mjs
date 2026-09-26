import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const port=Number(process.env.PORT??4173);
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('PORT must be an integer from 0 to 65535');
const routes=new Map([['/','web/index.html'],['/worker.js','web/worker.js'],['/analysis-controller.js','web/analysis-controller.js'],['/examples/security.json','examples/security.json'],['/app.js','web/app.js'],['/style.css','web/style.css'],['/engine.js','web/engine.js'],['/render.js','lib/render.mjs'],['/examples/old.json','examples/old.json'],['/examples/breaking.json','examples/breaking.json'],['/examples/compatible.json','examples/compatible.json'],['/examples/review.json','examples/review.json']]);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
const server=createServer(async(req,res)=>{
 const actualPort=server.address().port;
 const allowedHosts=new Set([`127.0.0.1:${actualPort}`,`localhost:${actualPort}`]);
 if(actualPort===80){allowedHosts.add('127.0.0.1');allowedHosts.add('localhost');}
 if(!allowedHosts.has(req.headers.host?.toLowerCase()) ||
    (req.headers.origin && ![...allowedHosts].some(host=>req.headers.origin===`http://${host}`))) {
  res.writeHead(403);res.end('Local origin required');return;
 }
 if(!req.url.startsWith('/')||req.url.startsWith('//')){res.writeHead(400);res.end('Origin-form request required');return;}
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end('Method not allowed');return;}
 let route;
 try{route=new URL(req.url,'http://localhost').pathname;}catch{res.writeHead(400);res.end('Bad request');return;}
 if(!routes.has(route)){res.writeHead(404);res.end('Not found');return;}
 try{const p=path.join(root,routes.get(route));const bytes=await readFile(p);res.writeHead(200,{'Content-Type':mime[path.extname(p)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(req.method==='HEAD'?undefined:bytes);}catch{res.writeHead(500);res.end('File missing. Run npm run build first.');}
});
server.listen(port,'127.0.0.1',()=>console.log(`MoonAPI Guard demo: http://127.0.0.1:${server.address().port}`));
server.on('error',e=>{console.error(e.message);process.exitCode=2;});
