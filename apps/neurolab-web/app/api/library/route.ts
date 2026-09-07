import {NextRequest,NextResponse} from "next/server";
import {catalog,preparePublication,publish,LibraryError,type PublishInput} from "@/lib/libraryServer";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(){try{return NextResponse.json({items:await catalog()},{headers:{"Cache-Control":"no-store"}});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Library unavailable"},{status:500});}}
export async function POST(req:NextRequest){try{
 const host=req.headers.get("host")??"";const localUrl=new URL("http://"+host);const origin=req.headers.get("origin");
 // Next may normalize req.url to its listening address; validate the browser Host instead.
 if(localUrl.host!==host||!["localhost","127.0.0.1","[::1]"].includes(localUrl.hostname)||(origin&&(!["http:","https:"].includes(new URL(origin).protocol)||new URL(origin).host!==host)))throw new LibraryError("Publishing is available only on the local app",403);
 if(Number(req.headers.get("content-length")??0)>6_000_000)throw new LibraryError("Publication exceeds 6 MB",413);
 const reader=req.body?.getReader();if(!reader)throw new LibraryError("Missing publication");const chunks:Uint8Array[]=[];let size=0;
 for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>6_000_000){await reader.cancel();throw new LibraryError("Publication exceeds 6 MB",413);}chunks.push(value);}
 const body=JSON.parse(Buffer.concat(chunks).toString("utf8")) as PublishInput;
 const item=req.nextUrl.searchParams.get("preview")==="1"?(await preparePublication(body)).item:await publish(body);
 return NextResponse.json({item},{status:req.nextUrl.searchParams.get("preview")==="1"?200:201});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Publication failed"},{status:e instanceof LibraryError?e.status:400});}}
