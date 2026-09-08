import {NextRequest,NextResponse} from "next/server";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 try{
  const origin=req.headers.get("origin"),host=req.headers.get("host");
  if(origin&&new URL(origin).host!==host)return NextResponse.json({error:"Cross-origin verification request rejected"},{status:403});
  const reader=req.body?.getReader();if(!reader)throw Error("Missing request body");const chunks:Uint8Array[]=[];let size=0;
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>1_000_000){await reader.cancel();return NextResponse.json({error:"Evidence request exceeds 1 MB"},{status:413});}chunks.push(value);}
  const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if(typeof body.bundleDir!=="string"||body.bundleDir.length>300||typeof body.blockPath!=="string"||body.blockPath.length>300)throw Error("Provide local bundle and model paths.");
  const result=await fetch("http://127.0.0.1:8788/v1/replay",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({bundleDir:body.bundleDir,blockPath:body.blockPath,receipt:body.receipt}),signal:AbortSignal.timeout(35000),cache:"no-store"});
  const text=await result.text();return NextResponse.json(JSON.parse(text),{status:result.status,headers:{"Cache-Control":"no-store"}});
 }catch(e){return NextResponse.json({error:"Replay unavailable or invalid request",message:e instanceof Error?e.message:String(e)},{status:503});}
}
