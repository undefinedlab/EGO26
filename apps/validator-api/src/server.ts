import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
const vmRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const port=Number(process.env.PORT??8788);
function localPath(input:string) {
 const resolved=realpathSync(path.resolve(vmRoot,input));const relative=path.relative(realpathSync(vmRoot),resolved);
 if(relative.startsWith("..")||path.isAbsolute(relative))throw new Error("Evidence path must remain inside the VM project");
 return resolved;
}
const server=createServer(async(req,res)=>{
 const origin=req.headers.origin;
 if(origin && !["http://localhost:3000","http://127.0.0.1:3000"].includes(origin)){res.writeHead(403);res.end();return;}
 if(origin)res.setHeader("Access-Control-Allow-Origin",origin);
 res.setHeader("Vary","Origin");res.setHeader("Content-Type","application/json");
 if(req.method==="OPTIONS"){res.setHeader("Access-Control-Allow-Methods","POST, GET, OPTIONS");res.setHeader("Access-Control-Allow-Headers","Content-Type");res.writeHead(204);res.end();return;}
 const send=(status:number,data:unknown)=>{res.writeHead(status);res.end(JSON.stringify(data));};
 if(req.method==="GET"&&req.url==="/health"){send(200,{ok:true});return;}
 if(req.method!=="POST"||req.url!=="/v1/replay"){send(404,{error:"not_found"});return;}
 try{
  const chunks:Buffer[]=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>1_000_000){send(413,{valid:false,error:"request_too_large"});return;}chunks.push(Buffer.from(chunk));}
  const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if(typeof body.bundleDir!=="string")throw new Error("bundleDir required");
  const bundle=localPath(body.bundleDir),block=localPath(body.blockPath??"blocks/loomguard/1.0.0/block.json");
  const stored=JSON.parse(readFileSync(localPath(path.join(bundle,"receipt.json")),"utf8"));
  if(body.receipt && !isDeepStrictEqual(body.receipt,stored))throw new Error("Submitted receipt differs from evidence bundle");
  for(const f of ["input.bin","state-before.bin","action.json","verifying-key.bin"])localPath(path.join(bundle,f));
  const run=spawnSync("cargo",["run","--offline","-q","-p","synapsevm-cli","--","replay",bundle,block],{cwd:vmRoot,encoding:"utf8",timeout:30_000,maxBuffer:2_000_000});
  if(run.error||!run.stdout.trim()){send(503,{valid:false,error:"replay_unavailable",message:run.error?.message??run.stderr});return;}
  const result=JSON.parse(run.stdout);
  send(200,{...result,valid:run.status===0&&result.valid===true});
 }catch(e){send(400,{valid:false,error:"invalid_evidence",message:e instanceof Error?e.message:String(e)});}
});
server.listen(port,"127.0.0.1",()=>console.log("Validator listening on http://127.0.0.1:"+port));
