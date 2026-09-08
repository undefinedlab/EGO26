import {notFound} from "next/navigation";
import {Shell} from "@/components/Shell";
import {RepositoryDetail} from "@/components/RepositoryDetail";
import {repository,LibraryError} from "@/lib/libraryServer";
import "../../library.css";
export const dynamic="force-dynamic";
export default async function RepositoryPage({params,searchParams}:{params:Promise<{owner:string;name:string}>;searchParams:Promise<{version?:string;tab?:string}>}){
 const {owner,name}=await params;const query=await searchParams;try{const {item}=await repository(owner,name,query.version);return <Shell active="EXPLORE" wide><RepositoryDetail item={item} initialTab={query.tab}/></Shell>;}catch(e){if(e instanceof LibraryError&&(e.status===404||e.status===400))notFound();throw e;}}
