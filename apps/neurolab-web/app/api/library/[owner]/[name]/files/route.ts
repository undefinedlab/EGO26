import {NextRequest,NextResponse} from "next/server";
import {repository,LibraryError} from "@/lib/libraryServer";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(req:NextRequest,{params}:{params:Promise<{owner:string;name:string}>}){try{
 const {owner,name}=await params;const repo=await repository(owner,name,req.nextUrl.searchParams.get("version")??undefined);const file=req.nextUrl.searchParams.get("path")??"";
 if(!Object.hasOwn(repo.files,file))throw new LibraryError("File not found",404);
 const content=repo.files[file];const headers:Record<string,string>={"Content-Type":file.endsWith(".json")||file.endsWith(".synapse")?"application/json":file.endsWith(".md")?"text/plain; charset=utf-8":"application/octet-stream","X-Content-Type-Options":"nosniff","Cache-Control":"no-store"};
 if(req.nextUrl.searchParams.get("download")==="1")headers["Content-Disposition"]='attachment; filename="'+file.split("/").pop()+'"';
 return new Response(new Uint8Array(content),{headers});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"File unavailable"},{status:e instanceof LibraryError?e.status:500});}}
