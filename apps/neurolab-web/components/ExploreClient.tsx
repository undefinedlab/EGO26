"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {KINDS,KIND_LABELS,KIND_HELP,filterLibrary,formatBytes,repoHref,releaseDate,type ArtifactKind,type LibraryItem} from "@/lib/library";
import {COVERAGE_LABELS,COVERAGE_HELP,primaryDownload,type Coverage} from "@/lib/datasets";
import {listBrains,type BrainSummary} from "@/lib/brainStore";
import {ROLE_LABELS,regionCount,hasNerveCord,type RegionRole} from "@/lib/brainAtlas";
import {formatCount} from "@/lib/brain";
import {TIMESCALE_LABELS} from "@/lib/circuitAtlas";
import {MotifDiagram} from "./MotifDiagram";
import {chainFor,verifiedCount,RELATION_LABELS,RELATION_HELP} from "@/lib/composition";
import {LibraryIcon as Icon} from "./LibraryIcon";
function brainItem(b:BrainSummary):LibraryItem{
 return {id:"local/"+b.id,owner:"local",slug:b.id,name:b.id,kind:"Brain",
  description:b.name+" imported from "+b.sourceFile+", normalised and hashed in this browser.",
  task:b.name,tags:["imported",b.adapter,"local"],version:"1.0.0",origin:"local",publishedAt:b.importedAt,
  license:"Local import",sourceType:"Imported graph",runtime:"Canonical graph",digest:b.digest,modelDigest:null,
  bytes:b.canonicalBytes,neurons:b.stats.nodes,synapses:b.stats.totalWeight,
  inputs:[b.stats.sources+" input neurons"],outputs:[b.stats.sinks+" output neurons"],
  actualInputs:[],actualOutputs:[],readme:"",
  lineage:[{kind:"Dataset",name:b.datasetId+"@"+b.datasetVersion,note:"Imported source",href:"/explore/"+b.datasetId}],
  files:[],releases:[],testCount:0,testsRun:false,benchmark:null,simulator:null,parent:null};
}

export function ExploreClient({items:serverItems}:{items:LibraryItem[]}){
 const [brains,setBrains]=useState<LibraryItem[]>([]);
 const [kind,setKind]=useState<ArtifactKind>("NeuroBlock");const [q,setQ]=useState("");const [task,setTask]=useState("");const [origin,setOrigin]=useState("");const [source,setSource]=useState("");const [sort,setSort]=useState("recent");const [view,setView]=useState("list");const [coverage,setCoverage]=useState("");const [organism,setOrganism]=useState("");const [role,setRole]=useState("");const [timescale,setTimescale]=useState("");const [savedOnly,setSavedOnly]=useState(false);const [saved,setSaved]=useState<string[]>([]);const [notice,setNotice]=useState("");const [ready,setReady]=useState(false);
 useEffect(()=>{const read=()=>{const p=new URLSearchParams(window.location.search);setKind(KINDS.includes(p.get("kind") as ArtifactKind)?p.get("kind") as ArtifactKind:"NeuroBlock");setQ(p.get("q")??"");setTask(p.get("task")??"");setOrigin(p.get("origin")??"");setSource(p.get("source")??"");setSort(p.get("sort")??"recent");setCoverage(p.get("coverage")??"");setOrganism(p.get("organism")??"");setRole(p.get("role")??"");setTimescale(p.get("timescale")??"");setSavedOnly(p.get("saved")==="1");};read();try{const data=JSON.parse(localStorage.getItem("synapsevm.library.saved")??"[]");if(Array.isArray(data))setSaved(data.filter(x=>typeof x==="string"));}catch{}setReady(true);window.addEventListener("popstate",read);return()=>window.removeEventListener("popstate",read);},[]);
 useEffect(()=>{if(!ready)return;const p=new URLSearchParams();if(kind!=="NeuroBlock")p.set("kind",kind);for(const [k,v] of Object.entries({q,task,origin,source,coverage,organism,role,timescale,sort:sort==="recent"?"":sort}))if(v)p.set(k,v);if(savedOnly)p.set("saved","1");window.history.replaceState(null,"",window.location.pathname+(p.size?"?"+p.toString():""));},[kind,q,task,origin,source,coverage,organism,role,timescale,sort,savedOnly,ready]);
 useEffect(()=>{listBrains().then(rows=>setBrains(rows.map(brainItem)));},[]);
 const items=useMemo(()=>[...serverItems,...brains],[serverItems,brains]);
 const selected=items.filter(i=>i.kind===kind);const tasks=[...new Set(selected.map(i=>i.task))];const sources=[...new Set(selected.map(i=>i.sourceType))];
 const isData=selected.some(i=>i.dataset);const isRegion=selected.some(i=>i.region);const isCircuit=selected.some(i=>i.circuit);const scales=[...new Set(selected.map(i=>i.circuit?.timescale).filter(Boolean))] as ("reflex"|"fast"|"deliberative")[];const roles=[...new Set(selected.map(i=>i.region?.def.role).filter(Boolean))] as RegionRole[];const coverages=[...new Set(selected.map(i=>i.dataset?.coverage).filter(Boolean))] as Coverage[];const organisms=[...new Set(selected.map(i=>i.dataset?.common??i.brain?.common).filter(Boolean))] as string[];
 const filtered=useMemo(()=>filterLibrary(items,{kind,q,task,origin,source,coverage,organism,role,timescale,sort,savedOnly,saved}),[items,kind,q,task,origin,source,coverage,organism,role,timescale,sort,savedOnly,saved]);
 const recent=items.filter(i=>i.origin==="local").sort((a,b)=>(b.publishedAt??"").localeCompare(a.publishedAt??"")).slice(0,3);
 const chooseKind=(value:ArtifactKind)=>{setKind(value);setTask("");setSource("");setCoverage("");setOrganism("");setRole("");setTimescale("");};
 const clear=()=>{setQ("");setTask("");setOrigin("");setSource("");setCoverage("");setOrganism("");setRole("");setTimescale("");setSavedOnly(false);};
 const toggleSave=(id:string)=>{const next=saved.includes(id)?saved.filter(s=>s!==id):[...saved,id];try{localStorage.setItem("synapsevm.library.saved",JSON.stringify(next));setSaved(next);}catch{setNotice("Your browser could not save this collection.");}};
 return <div className="library-page">
  <header className="lib-hero"><div><div className="lib-eyebrow"><span className="lib-live-dot"/> Discover</div><h1>Small pieces.<br className="lib-mobile-break"/> Shared intelligence.</h1><p>Find neural modules, inspect their origins, and build on what others publish.</p></div><Link className="lib-button primary" href="/explore/publish"><Icon name="upload"/> Publish a release</Link></header>
  <nav className="lib-kind-tabs" aria-label="Artifact categories">{KINDS.map(k=><button key={k} onClick={()=>chooseKind(k)} aria-pressed={kind===k} className={kind===k?"active":""}><Icon name={k==="NeuroBlock"?"block":k==="NeuroStack"?"stack":"source"} size={16}/>{KIND_LABELS[k]}<span>{items.filter(i=>i.kind===k).length}</span></button>)}</nav>
  <div className="lib-layout"><aside className="lib-filters" aria-label="Catalog filters">
   <div className="lib-filter-title"><strong>Discover</strong><button onClick={clear}>Reset</button></div>
   <button className={savedOnly?"lib-saved active":"lib-saved"} aria-pressed={savedOnly} onClick={()=>setSavedOnly(!savedOnly)}><Icon name="save" size={16}/> Saved collection <span>{saved.length}</span></button>
   {!isData&&!isRegion&&!isCircuit&&<fieldset><legend>Task</legend><button className={!task?"active":""} onClick={()=>setTask("")}>All tasks <span>{selected.length}</span></button>{tasks.map(t=><button key={t} className={task===t?"active":""} onClick={()=>setTask(task===t?"":t)}>{t}<span>{selected.filter(i=>i.task===t).length}</span></button>)}</fieldset>}
   <fieldset><legend>Publication</legend>{[["","All repositories"],["local","Community · local"],["bundled","Bundled examples"],["reference","Source references"]].map(([v,label])=><label key={v}><input type="radio" name="origin" checked={origin===v} onChange={()=>setOrigin(v)}/>{label}</label>)}</fieldset>
   {isData&&<fieldset className="lib-coverage"><legend>Completeness</legend>
    <button className={!coverage?"active":""} onClick={()=>setCoverage("")}>Any coverage <span>{selected.length}</span></button>
    {coverages.map(c=><button key={c} className={coverage===c?"active":""} onClick={()=>setCoverage(coverage===c?"":c)} title={COVERAGE_HELP[c]}>{COVERAGE_LABELS[c]}<span>{selected.filter(i=>i.dataset?.coverage===c).length}</span></button>)}
    <p className="lib-filter-note">A tissue sample is dense but has no pathway running through it, so no circuit can be derived from one.</p>
   </fieldset>}
   {organisms.length>1&&<fieldset><legend>Organism</legend>{organisms.map(o=><label key={o}><input type="checkbox" checked={organism===o} onChange={()=>setOrganism(organism===o?"":o)}/>{o}<span className="lib-filter-count">{selected.filter(i=>(i.dataset?.common??i.brain?.common)===o).length}</span></label>)}</fieldset>}
   {isCircuit&&<fieldset className="lib-coverage"><legend>Timescale</legend>
    <button className={!timescale?"active":""} onClick={()=>setTimescale("")}>Any speed <span>{selected.length}</span></button>
    {scales.map(t=><button key={t} className={timescale===t?"active":""} onClick={()=>setTimescale(timescale===t?"":t)}>{TIMESCALE_LABELS[t]}<span>{selected.filter(i=>i.circuit?.timescale===t).length}</span></button>)}
    <p className="lib-filter-note">A reflex has to finish before the next sensor frame. Anything slower can afford to deliberate.</p>
   </fieldset>}
   {isRegion&&<fieldset className="lib-coverage"><legend>Function</legend>
    <button className={!role?"active":""} onClick={()=>setRole("")}>Any role <span>{selected.length}</span></button>
    {roles.map(r=><button key={r} className={role===r?"active":""} onClick={()=>setRole(role===r?"":r)}>{ROLE_LABELS[r]}<span>{selected.filter(i=>i.region?.def.role===r).length}</span></button>)}
   </fieldset>}
   {!isData&&!isRegion&&!isCircuit&&<fieldset><legend>Model origin</legend>{sources.map(s=><label key={s}><input type="checkbox" checked={source===s} onChange={()=>setSource(source===s?"":s)}/>{s}</label>)}</fieldset>}
   <div className="lib-explainer"><Icon name={kind==="NeuroBlock"?"block":"source"}/><strong>What is a {kind}?</strong><p>{KIND_HELP[kind]}</p><span>Source → module → composition</span></div>
  </aside>
  <section className="lib-catalog" aria-label="Repository results">
   <div className="lib-results-head"><div><h2>{KIND_LABELS[kind]} <span>{filtered.length}</span></h2><p>{KIND_HELP[kind]}</p></div></div>
   <div className="lib-searchbar"><label className="lib-search"><Icon name="search"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by name, publisher, task, or interface…" aria-label="Search Discover"/>{q&&<button onClick={()=>setQ("")} aria-label="Clear search"><Icon name="close" size={15}/></button>}</label></div>
   <div className="lib-result-controls"><span aria-live="polite">{filtered.length} repositor{filtered.length===1?"y":"ies"}{savedOnly?" in your collection":""}</span><div><label>Sort <select aria-label="Sort repositories" value={sort} onChange={e=>setSort(e.target.value)}><option value="recent">Recently published</option><option value="name">Name A–Z</option><option value="smallest">Smallest package</option><option value="neurons">Neuron count</option></select></label><button aria-label="List view" aria-pressed={view==="list"} onClick={()=>setView("list")}><Icon name="list" size={16}/></button><button aria-label="Grid view" aria-pressed={view==="grid"} onClick={()=>setView("grid")}><Icon name="grid" size={16}/></button></div></div>
   {(task||origin||source||coverage||organism||role||timescale||savedOnly)&&<div className="lib-active-filters">{task&&<button onClick={()=>setTask("")}>{task} ×</button>}{origin&&<button onClick={()=>setOrigin("")}>{origin} ×</button>}{source&&<button onClick={()=>setSource("")}>{source} ×</button>}{coverage&&<button onClick={()=>setCoverage("")}>{COVERAGE_LABELS[coverage as Coverage]} ×</button>}{organism&&<button onClick={()=>setOrganism("")}>{organism} ×</button>}{role&&<button onClick={()=>setRole("")}>{ROLE_LABELS[role as RegionRole]} ×</button>}{timescale&&<button onClick={()=>setTimescale("")}>{TIMESCALE_LABELS[timescale as "reflex"]} ×</button>}{savedOnly&&<button onClick={()=>setSavedOnly(false)}>Saved ×</button>}</div>}
   {notice&&<p role="status">{notice}</p>}
   <div className={"lib-repositories "+(view==="grid"?"as-grid":"")}>
    {filtered.map(item=><article className="lib-repo-row" key={item.id}>
     <div className={"lib-avatar "+(item.origin==="local"?"violet":item.sourceType==="Connectome-derived"?"blue":"mint")}><Icon name={kind==="NeuroStack"?"stack":kind==="NeuroBlock"?"block":"source"} size={24}/></div>
     {item.motif&&<div className="lib-motif-figure"><MotifDiagram motif={item.motif}/></div>}
     <div className="lib-repo-main"><div className="lib-repo-title"><Link href={repoHref(item)}><span>{item.owner} / </span><strong>{item.name}</strong></Link><span className="lib-version">v{item.version}</span></div><p>{item.description}</p><div className="lib-row-tags">{item.circuit?<>
      <span className="lib-tag task">{item.circuit.common}</span>
      <span className={"lib-tag coverage "+(item.circuit.timescale==="reflex"?"complete-cns":"")}>{TIMESCALE_LABELS[item.circuit.timescale]}</span>
      {item.circuit.block?<span className="lib-tag derivable">Block: {item.circuit.block}</span>:<span className="lib-tag refonly">No block yet</span>}
     </>:item.motif?<>
      <span className="lib-tag task">{item.motif.analogue.split(" / ")[0]}</span>
      <span className="lib-tag derivable">Complete graph</span>
      <span className="lib-tag licence unknown">{item.motif.nodes.length}n · {item.motif.edges.length}e</span>
     </>:item.brain?<>
      <span className="lib-tag task">{item.brain.common}</span>
      <span className="lib-tag coverage complete-cns">{hasNerveCord(item.brain)?"Brain + nerve cord":item.brain.common==="Nematode worm"||item.brain.common==="Sea squirt tadpole"?"Whole nervous system":"Brain"}</span>
      <span className="lib-tag derivable">Pre-sliced anatomy</span>
     </>:item.region?<>
      <span className="lib-tag task">{ROLE_LABELS[item.region.def.role]}</span>
      <span className="lib-tag">{item.region.def.group}</span>
      <span className="lib-tag licence unknown">{item.region.def.abbr}</span>
     </>:item.dataset?<>
      <span className="lib-tag task">{item.dataset.common}</span>
      <span className={"lib-tag coverage "+item.dataset.coverage} title={COVERAGE_HELP[item.dataset.coverage]}>{COVERAGE_LABELS[item.dataset.coverage]}</span>
      <span className={item.dataset.derivable?"lib-tag derivable":"lib-tag refonly"}>{item.dataset.derivable?"Circuit derivable":"Reference only"}</span>
      <span className={"lib-tag licence "+(item.license.startsWith("CC BY-NC")?"warn":item.license.startsWith("CC")?"ok":"unknown")}>{item.license}</span>
     </>:<>
      <span className="lib-tag task">{item.task}</span><span className="lib-tag">{item.sourceType}</span><span className="lib-tag">{item.runtime}</span>
     </>}</div><div className="lib-row-meta">{item.circuit?<>
      <span>{item.circuit.stages.length} stages</span>
      <span>{item.circuit.regions.length} regions</span>
      <span>in {item.circuit.brains.length} brain{item.circuit.brains.length===1?"":"s"}</span>
      <span>pathway only · connectivity needs data</span>
     </>:item.motif?<>
      <span>{item.motif.nodes.length} neurons</span>
      <span>{item.motif.edges.length} connections</span>
      <span>in {item.motif.appearsIn.length} circuit{item.motif.appearsIn.length===1?"":"s"}</span>
      <span>ships complete</span>
     </>:item.brain?<>
      {item.neurons!==null&&<span>{item.neurons.toLocaleString()} neurons</span>}
      {item.brain.connections!==null&&<span>{formatCount(item.brain.connections)} connections</span>}
      <span>{regionCount(item.brain)} regions described</span>
      <span>no download needed</span>
     </>:item.region?<>
      {item.neurons!==null&&<span>{item.neurons.toLocaleString()} neurons</span>}
      <span>in {item.region.brains.length} brain{item.region.brains.length===1?"":"s"}</span>
      {item.region.def.hosts.length>0&&<span>{item.region.def.hosts.length} circuit{item.region.def.hosts.length===1?"":"s"} described</span>}
     </>:item.dataset?<>{item.neurons!==null&&<span>{item.neurons.toLocaleString()} neurons</span>}{item.synapses!==null&&<span>{item.synapses>=1e6?(item.synapses/1e6).toFixed(0)+"M synapses":item.synapses.toLocaleString()+" synapses"}</span>}{(()=>{const f=primaryDownload(item.dataset!);return f?<span>{formatBytes(f.bytes!)} · {f.label.toLowerCase()}</span>:<span>size not published</span>;})()}{item.dataset.imagery&&<span>{item.dataset.imagery} imagery</span>}<span>{releaseDate(item.publishedAt)}</span></>:<>{item.neurons!==null&&<span>{item.neurons.toLocaleString()} neurons</span>}<span>{formatBytes(item.bytes)}</span><span>{item.origin==="local"?releaseDate(item.publishedAt):item.origin==="reference"?"Reference only":"Bundled example"}</span><span>{item.origin==="local"?"By "+item.owner:"synapsevm collection"}</span></>}</div>{item.composition&&<div className="lib-made-of">
      <span className="lib-made-of-label">Made of</span>
      <ol className="lib-chain">
       {chainFor(item.composition).map(l=>(
        <li key={l.id} className={l.verified?"is-verified":"is-attributed"}>
         <Link href={"/explore/"+l.id} title={RELATION_HELP[l.relation]}>
          <span className="lib-chain-rel">{RELATION_LABELS[l.relation]}</span>
          <span className="lib-chain-name">{l.name}</span>
         </Link>
        </li>
       ))}
       <li className="is-self"><span><span className="lib-chain-rel">This</span><span className="lib-chain-name">{item.name}</span></span></li>
      </ol>
      {(()=>{const v=verifiedCount(item.composition!);return <span className="lib-chain-score" title="Claims backed by data in this repository, not by attribution alone">{v.verified}/{v.total} verified</span>;})()}
     </div>}
     <div className="lib-interface-line">{item.circuit?<>
      <span className="lib-pathway">{item.circuit.stages.map(st=>st.population).join("  \u2192  ")}</span>
     </>:item.motif?<>
      <span>{item.motif.computes}</span>
     </>:item.brain?<>
      <span>{item.brain.scope}</span>
      <Link className="lib-source-link" href={"/explore/import?dataset="+item.brain.datasetSlug}>Attach data →</Link>
     </>:item.region?<>
      <span>{item.region.def.hosts.join(" · ")||item.region.def.group}</span>
     </>:item.dataset?<><span>{item.dataset.scope}</span><a className="lib-source-link" href={item.dataset.homepage} target="_blank" rel="noreferrer noopener">Open source data ↗</a></>:<><span>{item.inputs.join(" · ")||"Source provenance"}</span><Icon name="arrow" size={14}/><span>{item.outputs.join(" · ")||"Referenced by LoomGuard"}</span></>}</div></div>
     <button className={"lib-bookmark "+(saved.includes(item.id)?"active":"")} aria-label={(saved.includes(item.id)?"Unsave ":"Save ")+item.name} aria-pressed={saved.includes(item.id)} onClick={()=>toggleSave(item.id)}><Icon name="save" size={17}/></button>
    </article>)}
   </div>
   {!filtered.length&&<div className="lib-empty"><Icon name={selected.length?"search":"source"} size={32}/><h3>{selected.length?"No matching repositories":"This part of Discover is open."}</h3><p>{selected.length?"Try a different task, publisher, or interface.":"No "+KIND_LABELS[kind].toLowerCase()+" have been added yet. Explore the available modules and their source lineage."}</p><button className="lib-button" onClick={()=>{clear();if(!selected.length)chooseKind("NeuroBlock");}}>{selected.length?"Clear filters":"Browse Blocks"}</button></div>}
   <p className="lib-catalog-foot">{items.filter(i=>i.origin==="local").length} local community repositories · No external registry connected</p>
  </section>
  <aside className="lib-community"><section className="lib-community-card"><div className="lib-eyebrow">BUILD IN THE OPEN</div><div className="lib-mini-graph" aria-hidden="true"><span><Icon name="source"/></span><i/><span><Icon name="block"/></span><i/><span><Icon name="stack"/></span></div><h3>Your next building block<br/>starts here.</h3><p>Give a neural module a home. Share its interface, source, and the tests that make it useful.</p><Link href="/explore/publish">Publish locally <Icon name="arrow" size={15}/></Link></section>
   <section className="lib-feed"><h3><Icon name="clock" size={16}/> Recent publications</h3>{recent.length?recent.map(i=><Link href={repoHref(i)} key={i.id}><span className="lib-feed-dot"/><div><strong>{i.owner}/{i.name}</strong><p>Released v{i.version}</p><small>{releaseDate(i.publishedAt)}</small></div></Link>):<div className="lib-feed-empty"><Icon name="people" size={24}/><p>Make the first local release.</p><small>New publications will appear here, with their author and version.</small></div>}</section>
   <section className="lib-guide"><h3>A clear path from biology to behavior.</h3><p><b>Sources</b> explain where it came from.</p><p><b>Blocks</b> define what it does.</p><p><b>Stacks</b> connect the pieces.</p><Link href="/compose">Open Compose <Icon name="arrow" size={14}/></Link></section>
  </aside></div>
 </div>;
}
