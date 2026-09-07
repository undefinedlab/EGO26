import {NextRequest,NextResponse} from "next/server";
import {repository,LibraryError} from "@/lib/libraryServer";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(req:NextRequest,{params}:{params:Promise<{owner:string;name:string}>}){try{const {owner,name}=await params;const {item}=await repository(owner,name,req.nextUrl.searchParams.get("version")??undefined);return NextResponse.json({item});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Repository unavailable"},{status:e instanceof LibraryError?e.status:500});}}
