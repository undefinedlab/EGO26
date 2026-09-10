import {importStack, DEFINITIONS} from "./composeCompiler";
import {readFile,readdir,mkdir,writeFile,link,unlink} from "node:fs/promises";
import path from "node:path";
import {createHash,randomUUID} from "node:crypto";
import {NEURO_BLOCKS} from "./blocks";
import {SynapseVmJs,validateBlock,type BlockJson} from "./synapseVm";
import {canonical,importPackage} from "./stackCompiler";
import {versionCompare,type LibraryItem,type Release} from "./library";
import {DATASETS,FEATURED,COVERAGE_LABELS,type DatasetMeta} from "./datasets";
import {BRAINS,REGION_SETS,ROLE_LABELS,regionsForBrain,type BrainDef,type RegionDef,type RegionSet} from "./brainAtlas";
import {CIRCUITS,TIMESCALE_LABELS,type CircuitDef} from "./circuitAtlas";
import {MOTIFS,motifsForCircuit,type MotifDef} from "./motifAtlas";
import {compositionFor} from "./composition";

type Repo={item:LibraryItem;files:Record<string,Buffer>};
export class LibraryError extends Error{constructor(message:string,public status=400){super(message);}}
export const sha=(value:string|Buffer)=>"sha256:"+createHash("sha256").update(value).digest("hex");
const json=(value:unknown)=>Buffer.from(JSON.stringify(value,null,2)+"\n");
export function vmRoot(){const cwd=process.cwd();return cwd.endsWith("neurolab-web")?path.resolve(cwd,"../.."):cwd;}
export function libraryDataDir(){return process.env.SYNAPSEVM_LIBRARY_DIR??path.join(vmRoot(),".synapse-library");}
const segment=/^[a-z0-9][a-z0-9_-]{0,47}$/;
const version=/^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$/;
export function validIdentity(owner:string,name:string,v?:string){if(!segment.test(owner)||!segment.test(name)||(v!==undefined&&!version.test(v)))throw new LibraryError("Invalid repository or release identifier");}
function finish(item:Omit<LibraryItem,"files"|"bytes"|"digest"|"releases">,files:Record<string,Buffer>):Repo{
 const entries=Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([name,raw])=>({name,bytes:raw.length,digest:sha(raw)}));
 const digest=sha(canonical(entries));
 return {item:{...item,files:entries,bytes:entries.reduce((sum,f)=>sum+f.bytes,0),digest,releases:[{version:item.version,digest,publishedAt:item.publishedAt,origin:item.origin}]},files};
}
async function optionalJson(file:string){try{return JSON.parse(await readFile(file,"utf8"));}catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return null;throw e;}}
async function readPackageFiles(dir:string){const files:Record<string,Buffer>={};async function visit(folder:string,prefix=""){for(const e of await readdir(folder,{withFileTypes:true})){if(e.isSymbolicLink())continue;const name=prefix+e.name;if(e.isDirectory()){if(["adapters","test-vectors"].includes(e.name))await visit(path.join(folder,e.name),name+"/");}else if(/\.(json|bin)$/.test(name)){files[name]=await readFile(path.join(folder,e.name));}}}await visit(dir);return files;}
async function bundled():Promise<Repo[]>{
 const root=vmRoot();const repos:Repo[]=[];
 for(const meta of NEURO_BLOCKS){
  const dir=path.join(root,"blocks",meta.id,meta.version);const files=await readPackageFiles(dir);
  const b=JSON.parse(files["block.json"].toString()) as BlockJson;const m=JSON.parse(files["manifest.json"].toString());const p=JSON.parse(files["provenance.json"].toString());
  const source=meta.id==="loomguard";const cp=p.connectomicProvenance??{};
  const readme=meta.tagline+"\n\n"+(source?"Connectivity is attributed to FlyWire optic escape circuitry. Fixed-point LIF parameters and the runtime assist are engineered modeling choices.":"This is an engineered demonstration model. Its intended behavior is "+meta.tagline.toLowerCase()+"; the bundled low-level runtime currently exposes a shared reflex decoder.")+"\n\nUse this repository to inspect the model, input mapping, provenance, and included test vectors before trying its simulator scenarios. Biological fidelity, deployment safety, and publisher identity have not been independently established.";
  files["README.md"]=Buffer.from(readme);
  const bench=source?await optionalJson(path.join(root,"benchmarks/latest.json")):null;
  repos.push(finish({id:"synapsevm/"+meta.id,owner:"synapsevm",slug:meta.id,name:meta.name,kind:"NeuroBlock",description:meta.tagline,task:({loomguard:"Collision avoidance",flowsense:"Optic flow",headingcell:"Navigation",targettrack:"Target tracking"} as Record<string,string>)[meta.id],tags:meta.tags,
   version:meta.version,origin:"bundled",publishedAt:null,license:m.license??"Not specified",sourceType:source?"Connectome-derived":"Engineered",runtime:"Q16.16 · fixed-v1",modelDigest:sha(files["block.json"]),neurons:b.neuronCount,synapses:b.csrPres.length,
   inputs:m.inputs??meta.inputs,outputs:m.outputs??meta.outputs,actualInputs:b.inputChannels.map(c=>c.name),actualOutputs:["danger","avoid_x","avoid_y","trigger"],readme,
   lineage:source?[{kind:"Dataset",name:cp.dataset??"FlyWire FAFB v783",note:"Reference recorded in provenance",href:"/explore/datasets/flywire-fafb"},{kind:"Circuit",name:"Optic escape pathway",note:"LC4 / LPLC2 → GF / escape populations",href:"/explore/references/optic-escape"},{kind:"Derivation",name:"Fixed-point LIF + engineered adapters",note:"Independent source reproduction pending"}]:[{kind:"Model source",name:"Engineered neural chain",note:cp.note??"No connectome extraction claimed"}],
   testCount:Object.keys(files).filter(f=>f.startsWith("test-vectors/")).length,testsRun:false,benchmark:bench?.block===meta.name+"@"+meta.version?{p50:bench.p50TickMs,p95:bench.p95TickMs,samples:bench.samples,note:"Stored local measurement; target hardware and methodology are incomplete. Not an independent benchmark."}:null,simulator:meta.id,parent:null,composition:compositionFor("synapsevm/"+meta.id)??undefined},files));
 }
 const stackRaw=await readFile(path.join(root,"blocks/biopilot/0.1.0/stack.json"));
 repos.push(finish({id:"synapsevm/biopilot",owner:"synapsevm",slug:"biopilot",name:"BioPilot",kind:"NeuroStack",description:"Visual navigation with an explicit collision-avoidance override.",task:"Navigation",tags:["composition","priority-arbiter","source"],version:"0.1.0",origin:"bundled",publishedAt:null,license:"Not specified",sourceType:"Composition",runtime:"Source graph",modelDigest:null,neurons:null,synapses:null,inputs:["EventVision","HeadingDelta"],outputs:["ControlVector"],actualInputs:[],actualOutputs:[],readme:"BioPilot combines LoomGuard, FlowSense, HeadingCell, and TargetTrack.\n\nThis bundled graph is a source template. It is not an executable Stack release. Use Workbench to inspect the complete starter graph and create a deterministic source package.",lineage:NEURO_BLOCKS.map(b=>({kind:"NeuroBlock",name:b.name+"@"+b.version,note:"Bundled dependency",href:"/explore/synapsevm/"+b.id})),testCount:0,testsRun:false,benchmark:null,simulator:null,parent:null,composition:compositionFor("synapsevm/biopilot")??undefined},{"stack.json":stackRaw}));
 for(const d of DATASETS) repos.push(datasetRepo(d));
 for(const b of BRAINS) repos.push(brainRepo(b));
 for(const r of regionCards()) repos.push(r);
 for(const c of CIRCUITS) repos.push(circuitRepo(c));
 for(const m of MOTIFS) repos.push(motifRepo(m));
 const loom=repos[0];
 for(const [slug,name,kind,description] of [["optic-escape","Optic escape pathway","Circuit","Looming-sensitive populations recorded in LoomGuard’s source lineage."]] as const){
  repos.push(finish({...loom.item,id:"references/"+slug,owner:"references",slug,name,kind,description,task:"Biological source",tags:["provenance","reference"],origin:"reference",version:"1.0.0",sourceType:"Source reference",runtime:"Not executable",modelDigest:null,neurons:null,synapses:null,inputs:[],outputs:[],actualInputs:[],actualOutputs:[],readme:description+"\n\nThis is a reference extracted from existing provenance, not a published dataset or standalone circuit package. The original scientific data is not hosted here. Inspect the provenance file and its consuming NeuroBlock.",lineage:[{kind:"Used by",name:"LoomGuard",note:"Source attribution",href:"/explore/synapsevm/loomguard"}],testCount:0,testsRun:false,benchmark:null,simulator:null,parent:null},{"provenance.json":loom.files["provenance.json"]}));
 }
 return repos;
}

function datasetRepo(d:DatasetMeta):Repo{
 const featured=FEATURED.includes(d.slug);
 const readme=[d.summary,"",
  "**Scope** "+d.scope,
  "**Coverage** "+COVERAGE_LABELS[d.coverage]+(d.derivable?" · a complete circuit can be extracted":" · reference only, no complete pathway inside the volume"),
  "**Licence** "+d.license+(d.licenseNote?" — "+d.licenseNote:""),
  "**Produced by** "+d.producer,
  "",
  "SynapseVM does not host this data. This card records what the dataset is, where it lives, and what it costs to fetch. Counts are the publishers' own; figures that could not be verified are omitted rather than estimated.",
  ...(d.notes?.length?["",...d.notes.map(n=>"- "+n)]:[]),
  "","Cite as: "+d.citation,
 ].join("\n");
 const files:Record<string,Buffer>={"dataset.json":json(d),"README.md":Buffer.from(readme+"\n")};
 return finish({
  id:"datasets/"+d.slug,owner:"datasets",slug:d.slug,name:d.name,kind:"Dataset",
  description:d.summary,task:d.common,
  tags:[d.coverage,d.common.toLowerCase(),...(d.derivable?["derivable"]:["reference-only"]),...(featured?["featured"]:[])],
  version:"1.0.0",origin:"reference",publishedAt:d.released,license:d.license,
  sourceType:COVERAGE_LABELS[d.coverage],runtime:"Not executable",modelDigest:null,
  neurons:d.neurons,synapses:d.synapses,
  inputs:[],outputs:[],actualInputs:[],actualOutputs:[],readme,
  lineage:[{kind:"Publisher",name:d.producer,note:d.version+(d.released?" · "+d.released:"")}],
  testCount:0,testsRun:false,benchmark:null,simulator:null,parent:null,dataset:d,
 },files);
}


/* ---- Atlas: brains and regions ship as knowledge, not as downloads ------- */

function brainRepo(b:BrainDef):Repo{
 const regions=regionsForBrain(b);
 const readme=[b.summary,"",
  "**Scope** "+b.scope,
  "**Source dataset** "+b.datasetSlug,
  "**Regions** "+regions.length+" described",
  "",
  "The anatomy below is published and ships with the library. Downloading the source dataset is only needed to compute exact per-region counts or to derive a circuit.",
  ...(b.superclasses?["","Composition:",...b.superclasses.map(c=>"- "+c.name+" — "+c.count.toLocaleString()+" ("+c.note+")")]:[]),
  ...(b.notes.length?["",...b.notes.map(n=>"- "+n)]:[]),
 ].join("\n");
 const files:Record<string,Buffer>={"brain.json":json({...b,regions:regions.map(r=>r.slug)}),"README.md":Buffer.from(readme+"\n")};
 return finish({
  id:"brains/"+b.slug,owner:"brains",slug:b.slug,name:b.name,kind:"Brain",
  description:b.summary,task:b.common,
  tags:["atlas",b.common.toLowerCase(),...b.regionSets],
  version:"1.0.0",origin:"reference",publishedAt:null,license:"Anatomy · published nomenclature",
  sourceType:"Atlas",runtime:"Not executable",modelDigest:null,
  neurons:b.neurons,synapses:b.synapses,
  inputs:[],outputs:[],actualInputs:[],actualOutputs:[],readme,
  lineage:[{kind:"Dataset",name:b.datasetSlug,note:"Source connectome",href:"/explore/datasets/"+b.datasetSlug},
   ...(b.superclasses?[{kind:"Composition",name:b.superclasses.length+" neuron classes",note:"Published breakdown"}]:[])],
  testCount:0,testsRun:false,benchmark:null,simulator:null,parent:null,brain:b,
 },files);
}

/** A region is described once and lists the brains that contain it. */
function regionCards():Repo[]{
 const owners=new Map<string,{def:RegionDef;brains:BrainDef[]}>();
 for(const b of BRAINS) for(const set of b.regionSets) for(const def of REGION_SETS[set as RegionSet]){
  const row=owners.get(def.slug)??{def,brains:[]};row.brains.push(b);owners.set(def.slug,row);
 }
 return [...owners.values()].map(({def,brains})=>{
  const names=brains.map(b=>b.name);
  const readme=[def.summary,"",
   "**Abbreviation** "+def.abbr,
   "**Group** "+def.group,
   "**Role** "+ROLE_LABELS[def.role],
   "**Present in** "+names.join(", "),
   ...(def.hosts.length?["","Circuits described here:",...def.hosts.map(h=>"- "+h)]:[]),
   "",
   "Neuron counts per region are not published for most connectomes. Import the source dataset to compute them for a specific brain.",
  ].join("\n");
  const files:Record<string,Buffer>={"region.json":json({...def,brains:brains.map(b=>b.slug)}),"README.md":Buffer.from(readme+"\n")};
  return finish({
   id:"regions/"+def.slug,owner:"regions",slug:def.slug,name:def.name,kind:"Region",
   description:def.summary,task:ROLE_LABELS[def.role],
   tags:["atlas",def.role,def.group.toLowerCase()],
   version:"1.0.0",origin:"reference",publishedAt:null,license:"Anatomy · published nomenclature",
   sourceType:def.group,runtime:"Not executable",modelDigest:null,
   neurons:def.neurons,synapses:null,
   inputs:[def.abbr],outputs:def.hosts.slice(0,2),actualInputs:[],actualOutputs:[],readme,
   lineage:brains.map(b=>({kind:"Brain",name:b.name,note:"Contains this region",href:"/explore/brains/"+b.slug})),
   testCount:0,testsRun:false,benchmark:null,simulator:null,parent:null,
   region:{def,brains:names},
  },files);
 });
}


function circuitRepo(c:CircuitDef):Repo{
 const path=c.stages.map(s=>s.population).join(" -> ");
 const readme=[c.summary,"",
  "**Computes** "+c.computes,
  "**Behaviour** "+c.behaviour,
  "**Timescale** "+TIMESCALE_LABELS[c.timescale],
  "**Pathway** "+path,
  "",
  "Stages:",
  ...c.stages.map(s=>"- "+s.population+" ("+s.role+", "+s.region+") — "+s.note),
  "",
  "The pathway is published anatomy and ships here. The connectivity behind it comes from the source dataset: import a brain to extract the actual neurons and weights.",
  ...(c.notes.length?["",...c.notes.map(x=>"- "+x)]:[]),
  "","Cite as: "+c.citation,
 ].join("\n");
 const files:Record<string,Buffer>={"circuit.json":json(c),"README.md":Buffer.from(readme+"\n")};
 const motifs=motifsForCircuit(c.slug);
 return finish({
  id:"circuits/"+c.slug,owner:"circuits",slug:c.slug,name:c.name,kind:"Circuit",
  description:c.summary,task:TIMESCALE_LABELS[c.timescale],
  tags:["pathway",c.common.toLowerCase(),c.timescale,...(c.block?["has-block"]:[])],
  version:"1.0.0",origin:"reference",publishedAt:null,license:"Anatomy · published literature",
  sourceType:"Pathway",runtime:"Not executable",modelDigest:null,neurons:null,synapses:null,
  inputs:c.stages.filter(s=>s.role==="input").map(s=>s.population),
  outputs:c.stages.filter(s=>s.role==="output").map(s=>s.population),
  actualInputs:[],actualOutputs:[],readme,
  lineage:[
   ...c.brains.map(b=>({kind:"Brain",name:b,note:"Contains this circuit",href:"/explore/brains/"+b})),
   ...motifs.map(m=>({kind:"Motif",name:m.name,note:"Used here",href:"/explore/motifs/"+m.slug})),
   ...(c.block?[{kind:"NeuroBlock",name:c.block,note:"Derived module",href:"/explore/synapsevm/"+c.block}]:[]),
  ],
  testCount:0,testsRun:false,benchmark:null,simulator:c.block,parent:null,circuit:c,
 },files);
}

/** Motifs are small enough to ship whole, so the graph itself is the artifact. */
function motifRepo(m:MotifDef):Repo{
 const readme=[m.summary,"",
  "**Computes** "+m.computes,
  "**Engineering equivalent** "+m.analogue,
  "**Size** "+m.nodes.length+" neurons, "+m.edges.length+" connections",
  "",
  "Unlike a brain or a circuit, this artifact is complete: the graph below is the motif, not a pointer to it. Only the LIF parameters are missing before it can run.",
  "",
  "Appears in:",
  ...m.appearsIn.map(a=>"- "+a.circuit+" — "+a.note),
  ...(m.notes.length?["",...m.notes.map(x=>"- "+x)]:[]),
 ].join("\n");
 const files:Record<string,Buffer>={"motif.json":json({nodes:m.nodes,edges:m.edges}),"README.md":Buffer.from(readme+"\n")};
 const inhibitory=m.edges.filter(x=>x.sign===-1).length;
 return finish({
  id:"motifs/"+m.slug,owner:"motifs",slug:m.slug,name:m.name,kind:"Motif",
  description:m.computes,task:m.analogue.split(" / ")[0],
  tags:["complete","graph",...(inhibitory?["inhibitory"]:["excitatory"])],
  version:"1.0.0",origin:"reference",publishedAt:null,license:"Structure · public domain pattern",
  sourceType:"Complete graph",runtime:"Structure only",modelDigest:null,
  neurons:m.nodes.length,synapses:m.edges.length,
  inputs:m.nodes.filter(x=>x.kind==="input").map(x=>x.label||x.id),
  outputs:m.nodes.filter(x=>x.kind==="output").map(x=>x.label||x.id),
  actualInputs:[],actualOutputs:[],readme,
  lineage:m.appearsIn.map(a=>({kind:"Circuit",name:a.circuit,note:a.note,href:"/explore/circuits/"+a.circuit})),
  testCount:0,testsRun:false,benchmark:null,simulator:null,parent:null,motif:m,
 },files);
}

type StoredRelease={format:"synapsevm.local-release.v1";item:LibraryItem;files:Record<string,string>};
async function localRepos(dir=libraryDataDir()):Promise<Repo[]>{
 let names:string[];try{names=await readdir(dir);}catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return [];throw e;}
 const rows:Repo[]=[];
 for(const name of names.filter(n=>n.endsWith(".json"))){const r=JSON.parse(await readFile(path.join(dir,name),"utf8")) as StoredRelease;
  if(r.format!=="synapsevm.local-release.v1")throw new LibraryError("Unsupported local release file",500);
  const files=Object.fromEntries(Object.entries(r.files).map(([k,v])=>[k,Buffer.from(v,"base64")]));const checked=finish(r.item,files);
  if(checked.item.digest!==r.item.digest)throw new LibraryError("Stored release integrity mismatch: "+r.item.id,500);rows.push(checked);
 }
 return rows;
}
export async function catalog(){const rows=[...await bundled(),...await localRepos()];const groups=new Map<string,Repo[]>();for(const row of rows)groups.set(row.item.id,[...groups.get(row.item.id)??[],row]);
 return [...groups.values()].map(releases=>{releases.sort((a,b)=>versionCompare(b.item.version,a.item.version));return {...releases[0].item,releases:releases.map(r=>({version:r.item.version,digest:r.item.digest,publishedAt:r.item.publishedAt,origin:r.item.origin}))};});}
export async function repository(owner:string,name:string,v?:string){validIdentity(owner,name,v);const id=owner+"/"+name;const rows=[...await bundled(),...await localRepos()].filter(r=>r.item.id===id).sort((a,b)=>versionCompare(b.item.version,a.item.version));const chosen=v?rows.find(r=>r.item.version===v):rows[0];if(!chosen)throw new LibraryError("Repository or release not found",404);chosen.item.releases=rows.map(r=>({version:r.item.version,digest:r.item.digest,publishedAt:r.item.publishedAt,origin:r.item.origin}));return chosen;}
export type PublishInput={owner:string;name:string;version:string;description:string;task:string;license:string;readme:string;provenance:string;kind:"NeuroBlock"|"NeuroStack";artifact:string;testVectors:string;parent?:{id:string;version:string;digest:string}|null};
export async function preparePublication(body:PublishInput):Promise<Repo>{
 if(!body||typeof body!=="object")throw new LibraryError("Invalid publication");
 for(const k of ["owner","name","version","description","task","license","readme","provenance","artifact"] as const)if(typeof body[k]!=="string")throw new LibraryError("Missing "+k);
 validIdentity(body.owner,body.name,body.version);
 if(["synapsevm","references"].includes(body.owner))throw new LibraryError("Choose your own namespace; bundled namespaces are reserved");
 if(body.description.trim().length<10||body.description.length>280)throw new LibraryError("Description must be 10–280 characters");
 if(body.readme.trim().length<20||body.readme.length>20_000||body.provenance.trim().length<10||body.provenance.length>4000)throw new LibraryError("Add an overview (20+ characters) and provenance (10+ characters)");
 if(!body.license.trim()||body.license.length>100||!body.task.trim()||body.task.length>80)throw new LibraryError("Task and license are required");
 if(Buffer.byteLength(body.artifact)>4_000_000)throw new LibraryError("Artifact exceeds 4 MB");
 const files:Record<string,Buffer>={"README.md":Buffer.from(body.readme),"provenance.json":json({kind:"PublisherStatement",statement:body.provenance,independentlyVerified:false})};
 let stackExecutable=false;
 let neurons:number|null=null,synapses:number|null=null,inputs:string[]=[],outputs:string[]=[],testCount=0,modelDigest:string|null=null;
 if(body.kind==="NeuroBlock"){
  const block=JSON.parse(body.artifact) as BlockJson&{schema:string};if(block.schema!=="synapsevm.blockbytes.v1"||block.neuronCount>10000)throw new LibraryError("Expected fixed-v1 block.json with at most 10,000 neurons");validateBlock(block);
  if(block.csrPres.length>200000)throw new LibraryError("Model exceeds local validation edge limit");
  const vectors=JSON.parse(body.testVectors) as {name:string;input:number[];ticks:number}[];
  if(!Array.isArray(vectors)||vectors.length<1||vectors.length>16)throw new LibraryError("Include 1–16 test vectors");
  const report=[];
  for(const v of vectors){if(typeof v.name!=="string"||!v.name||v.name.length>80||!Array.isArray(v.input)||!Number.isInteger(v.ticks)||v.ticks<1||v.ticks>8)throw new LibraryError("Each test needs name, input, and 1–8 ticks");
   const vm=new SynapseVmJs(block);let result;for(let tick=0;tick<v.ticks;tick++)result=vm.step(v.input,tick);
   report.push({name:v.name,ticks:v.ticks,output:{danger:result!.danger,avoidX:result!.avoidX,avoidY:result!.avoidY,trigger:result!.trigger},stateDigest:sha(Buffer.from(vm.snapshot()))});
  }
  files["block.json"]=Buffer.from(body.artifact);files["test-vectors.json"]=json(vectors);files["test-report.json"]=json({scope:"Local smoke execution; no expected-output assertions or independent replay",results:report});
  neurons=block.neuronCount;synapses=block.csrPres.length;inputs=block.inputChannels.map(c=>c.name);outputs=["danger","avoid_x","avoid_y","trigger"];testCount=vectors.length;modelDigest=sha(body.artifact);
 }else if(body.kind==="NeuroStack"){
  const raw=JSON.parse(body.artifact);const pkg=raw.format==="synapsevm.compose-package.v1"?await importStack(body.artifact):await importPackage(body.artifact);files["stack.synapse"]=Buffer.from(body.artifact);inputs=pkg.graph.nodes.filter(n=>DEFINITIONS[n.type]?.family==="sensor").flatMap(n=>Object.keys(DEFINITIONS[n.type].outputs).map(p=>n.id+"."+p));outputs=pkg.graph.nodes.filter(n=>DEFINITIONS[n.type]?.family==="actuator").map(n=>n.id);modelDigest=pkg.manifest.stackId;stackExecutable=pkg.manifest.executable;
 }else throw new LibraryError("Local publishing currently supports NeuroBlocks and NeuroStacks");
 let parent:LibraryItem["parent"]=null;
 if(body.parent){const [owner,name,...rest]=body.parent.id.split("/");if(rest.length)throw new LibraryError("Invalid fork parent");const base=await repository(owner,name,body.parent.version);if(base.item.digest!==body.parent.digest||base.item.kind!==body.kind)throw new LibraryError("Fork parent digest or artifact kind mismatch");parent={id:base.item.id,version:base.item.version,digest:base.item.digest};}
 files["interface.json"]=json({kind:"Interface",numericFormat:"Q16.16",inputs,outputs});
 files["manifest.json"]=json({kind:body.kind,name:body.name,namespace:body.owner,version:body.version,description:body.description.trim(),license:body.license,task:body.task,modelDigest,source:parent,executable:body.kind==="NeuroBlock"||stackExecutable,runtime:body.kind==="NeuroBlock"?"synapsevm-fixed-v1":stackExecutable?"synapsevm-compose-js-v1":"source-package",publisherIdentity:"self-declared-local",signature:null});
 return finish({id:body.owner+"/"+body.name,owner:body.owner,slug:body.name,name:body.name,kind:body.kind,description:body.description.trim(),task:body.task,tags:["local",body.kind==="NeuroBlock"?"Q16.16":"composition"],version:body.version,origin:"local",publishedAt:new Date().toISOString(),license:body.license,sourceType:parent?"Fork":"Publisher supplied",runtime:body.kind==="NeuroBlock"?"Q16.16 · fixed-v1":stackExecutable?"Compose JS · executable":"Source graph",modelDigest,neurons,synapses,inputs,outputs,actualInputs:inputs,actualOutputs:outputs,readme:body.readme,lineage:[{kind:"Publisher statement",name:body.provenance,note:"Not independently verified"}],testCount,testsRun:body.kind==="NeuroBlock",benchmark:null,simulator:body.kind==="NeuroStack"?"/compose?repository="+encodeURIComponent(body.owner+"/"+body.name)+"&version="+body.version:null,parent},files);
}
export async function publish(body:PublishInput,dir=libraryDataDir()){
 const repo=await preparePublication(body);await mkdir(dir,{recursive:true});
 const file=path.join(dir,body.owner+"--"+body.name+"--"+body.version+".json");
 const existing=(await localRepos(dir)).filter(r=>r.item.id===repo.item.id);if(existing.some(r=>r.item.kind!==repo.item.kind))throw new LibraryError("A repository cannot change artifact kind",409);
 const stored:StoredRelease={format:"synapsevm.local-release.v1",item:repo.item,files:Object.fromEntries(Object.entries(repo.files).map(([k,v])=>[k,v.toString("base64")]))};
 const pending=path.join(dir,".pending-"+randomUUID()+".tmp");
 try{await writeFile(pending,JSON.stringify(stored),{flag:"wx"});await link(pending,file);}catch(e){if((e as NodeJS.ErrnoException).code==="EEXIST")throw new LibraryError("This version already exists. Choose a new version; releases are immutable.",409);throw e;}finally{await unlink(pending).catch(()=>{});}
 return repo.item;
}
