import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const port=Number(process.env.PORT??4173);
const routes=new Map([['/','web/index.html'],['/app.js','web/app.js'],['/style.css','web/style.css'],['/engine.js','web/engine.js'],['/render.js','lib/render.mjs'],['/examples/old.json','examples/old.json'],['/examples/breaking.json','examples/breaking.json'],['/examples/compatible.json','examples/compatible.json'],['/examples/review.json','examples/review.json']]);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
const server=createServer(async(req,res)=>{
 const route=new URL(req.url,'http://localhost').pathname;
 if(!routes.has(route)){res.writeHead(404);res.end('Not found');return;}
 try{const p=path.join(root,routes.get(route));const bytes=await readFile(p);res.writeHead(200,{'Content-Type':mime[path.extname(p)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);}catch{res.writeHead(500);res.end('File missing. Run npm run build first.');}
});
server.listen(port,'127.0.0.1',()=>console.log(`MoonAPI Guard demo: http://127.0.0.1:${port}`));
server.on('error',e=>{console.error(e.message);process.exitCode=2;});
