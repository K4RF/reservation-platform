const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname,port=Number(process.env.PROTOTYPE_PORT||4381);
const approvedDocument=path.resolve(root,'../../approved-design.md');
http.createServer((req,res)=>{let target;try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);target=pathname==='/approved-design.md'?approvedDocument:path.resolve(root,'.'+pathname);}catch{res.writeHead(400).end();return;}
 if(!target.startsWith(root+path.sep)&&target!==root&&target!==approvedDocument){res.writeHead(403).end();return;}
 if(target===root||target.endsWith(path.sep))target=path.join(target,'index.html');
 fs.readFile(target,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.md':'text/plain; charset=utf-8'})[path.extname(target)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(data)});
}).listen(port,'127.0.0.1',()=>process.stdout.write(`Design prototype: http://127.0.0.1:${port}\n`));
