import {Shell} from "@/components/Shell";
import {ExploreClient} from "@/components/ExploreClient";
import {catalog} from "@/lib/libraryServer";
import "./library.css";
export const dynamic="force-dynamic";
export default async function ExplorePage(){return <Shell active="EXPLORE" wide><ExploreClient items={await catalog()}/></Shell>;}
