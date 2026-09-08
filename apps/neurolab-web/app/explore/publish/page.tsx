import {Shell} from "@/components/Shell";
import {PublishRelease} from "@/components/PublishRelease";
import {catalog} from "@/lib/libraryServer";
import "../library.css";
export const dynamic="force-dynamic";
export default async function PublishPage(){return <Shell active="EXPLORE" wide><PublishRelease items={await catalog()}/></Shell>;}
