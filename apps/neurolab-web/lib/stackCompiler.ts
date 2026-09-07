import { validateBlock, type BlockJson } from "./synapseVm";

export const RUNTIME = "synapsevm-fixed-v1";
export type GraphNode = { id: string; type: string; params?: Record<string, number> };
export type GraphEdge = { from: string; to: string; mode?: "LATEST" };
export type StackGraph = { name: string; version: string; nodes: GraphNode[]; edges: GraphEdge[]; deadlineMs: number };
type Definition = { family: string; inputs: Record<string, string>; outputs: Record<string, string>; estimatedMs: number; priority: number; module?: string };
export const NODE_DEFS: Record<string, Definition> = {
  EventCamera: { family: "sensor", inputs: {}, outputs: { events: "EventVision/v1" }, estimatedMs: 1, priority: 0 },
  IMU: { family: "sensor", inputs: {}, outputs: { heading: "HeadingDelta/v1" }, estimatedMs: 0.2, priority: 0 },
  LoomGuard: { family: "neuroblock", inputs: { event_vision: "EventVision/v1" }, outputs: { avoidance_vector: "AvoidanceSignal/v1" }, estimatedMs: 2, priority: 0, module: "loomguard" },
  FlowSense: { family: "neuroblock", inputs: { event_vision: "EventVision/v1" }, outputs: { optic_flow: "OpticFlow/v1" }, estimatedMs: 2, priority: 2, module: "flowsense" },
  TargetTrack: { family: "neuroblock", inputs: { event_vision: "EventVision/v1" }, outputs: { target_bearing: "TargetBearing/v1" }, estimatedMs: 2, priority: 2, module: "targettrack" },
  HeadingCell: { family: "neuroblock", inputs: { optic_flow: "OpticFlow/v1", target_bearing: "TargetBearing/v1", heading_delta: "HeadingDelta/v1" }, outputs: { steering_command: "SteeringCommand/v1" }, estimatedMs: 1, priority: 1, module: "headingcell" },
  Arbiter: { family: "control", inputs: { nominal: "SteeringCommand/v1", override: "AvoidanceSignal/v1" }, outputs: { command: "ControlVector/v1" }, estimatedMs: 0.1, priority: 0 },
  DroneControl: { family: "actuator", inputs: { control: "ControlVector/v1" }, outputs: {}, estimatedMs: 0.5, priority: 0 },
};
export type Diagnostic = { code: string; message: string };
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export function canonical(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (typeof value === "object" && value !== null) return "{" + Object.keys(value).sort(compare).map(k => JSON.stringify(k) + ":" + canonical((value as Record<string, unknown>)[k])).join(",") + "}";
  throw new Error("Only finite JSON values are supported");
}
export async function digest(bytes: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bytes));
  return "sha256:" + Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
}
export function validateGraph(graph: StackGraph) {
  const errors: Diagnostic[] = [];
  const fail = (code: string, message: string) => errors.push({ code, message });
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new Error("Invalid Stack graph");
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(graph.name) || !/^\d+\.\d+\.\d+$/.test(graph.version)) fail("METADATA", "Use a simple Stack name and a three-part version");
  if (!Number.isFinite(graph.deadlineMs) || graph.deadlineMs <= 0) fail("TIMING", "Deadline must be positive");
  const nodes = new Map<string, GraphNode>();
  for (const node of graph.nodes) {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(node.id) || nodes.has(node.id)) fail("NODE", "Invalid or duplicate node ID: " + node.id);
    if (!Object.hasOwn(NODE_DEFS,node.type)) fail("NODE", "Unsupported node: " + node.type);
    if (Object.entries(node.params ?? {}).some(([k,v]) => k !== "hz" || NODE_DEFS[node.type]?.family !== "sensor" || !Number.isInteger(v) || v <= 0 || v > 1000)) fail("PARAMETER", "Only sensor hz (1–1000) is supported: " + node.id);
    nodes.set(node.id, node);
  }
  if(errors.some(e=>e.code==="NODE")) return {errors,schedule:[] as string[],estimatedCriticalPathMs:0};
  const incoming = new Map<string, string[]>();
  const successors = new Map(graph.nodes.map(n => [n.id, [] as string[]]));
  const indegree = new Map(graph.nodes.map(n => [n.id, 0]));
  for (const edge of graph.edges) {
    const [src, out, extraOut] = edge.from.split("."); const [dst, port, extraIn] = edge.to.split(".");
    const a = nodes.get(src), b = nodes.get(dst);
    const output = a && NODE_DEFS[a.type]?.outputs[out]; const input = b && NODE_DEFS[b.type]?.inputs[port];
    if (extraOut || extraIn || !output || !input || output !== input) { fail("TYPE", edge.from + " → " + edge.to + ": incompatible or missing typed port"); continue; }
    if (edge.mode && edge.mode !== "LATEST") fail("DELIVERY", "Only LATEST tick-batched delivery is implemented");
    const writers = incoming.get(edge.to) ?? []; writers.push(src); incoming.set(edge.to, writers);
    if (writers.length > 1) fail("WRITERS", edge.to + " has multiple writers; use an explicit arbiter");
    successors.get(src)!.push(dst); indegree.set(dst, indegree.get(dst)! + 1);
  }
  for (const node of graph.nodes) {
    for (const port of Object.keys(NODE_DEFS[node.type]?.inputs ?? {})) if (!incoming.has(node.id + "." + port)) fail("MISSING_INPUT", node.id + "." + port + " has no source");
  }
  if (!graph.nodes.some(n => NODE_DEFS[n.type]?.family === "actuator")) fail("ACTUATOR", "Add a final actuator command node");
  const ready = graph.nodes.filter(n => indegree.get(n.id) === 0).map(n => n.id);
  const schedule: string[] = []; const latency = new Map<string, number>(); const rates = new Map<string, number>();
  while (ready.length) {
    ready.sort((a,b) => (NODE_DEFS[nodes.get(a)!.type]?.priority ?? 4) - (NODE_DEFS[nodes.get(b)!.type]?.priority ?? 4) || compare(a,b));
    const id = ready.shift()!; const node = nodes.get(id)!; const def = NODE_DEFS[node.type]; schedule.push(id);
    const parents = Object.keys(def?.inputs ?? {}).flatMap(p => incoming.get(id + "." + p) ?? []);
    latency.set(id, Math.max(0, ...parents.map(p => latency.get(p) ?? 0)) + (def?.estimatedMs ?? 0));
    rates.set(id, def?.family === "sensor" ? node.params?.hz ?? 200 : Math.min(...parents.map(p => rates.get(p) ?? 0)));
    if (node.type === "LoomGuard" && (rates.get(id) ?? 0) < 100) fail("ENVELOPE", "LoomGuard requires at least 100 Hz; source provides " + rates.get(id) + " Hz");
    for (const next of successors.get(id) ?? []) { indegree.set(next, indegree.get(next)! - 1); if (indegree.get(next) === 0) ready.push(next); }
  }
  if (schedule.length !== graph.nodes.length) fail("CYCLE", "Implicit cycle detected; state/delay nodes are not supported in this compiler version");
  const estimatedCriticalPathMs = Math.max(0, ...latency.values());
  if (estimatedCriticalPathMs > graph.deadlineMs) fail("DEADLINE", "Estimated path " + estimatedCriticalPathMs + " ms exceeds deadline " + graph.deadlineMs + " ms");
  return { errors, schedule, estimatedCriticalPathMs };
}
export type SourcePackage = {
  format: "synapsevm.source-package.v1";
  manifest: { kind: "NeuroStack"; name: string; version: string; stackId: string; runtime: string; executable: false; signature: null };
  graph: StackGraph;
  lockfile: Record<string, { version: string; digest: string }>;
  runtimePlan: { order: string[]; delivery: string; arbitration: string; estimatedCriticalPathMs: number; executable: false };
  modules: Record<string, string>;
};
export async function compileStack(graph: StackGraph, load: (slug: string) => Promise<string>): Promise<SourcePackage> {
  const result = validateGraph(graph);
  if (result.errors.length) throw new Error(result.errors.map(e => e.code + ": " + e.message).join("\n"));
  const clean: StackGraph = { name: graph.name, version: graph.version, deadlineMs: graph.deadlineMs,
    nodes: graph.nodes.map<GraphNode>(n => ({ id: n.id, type: n.type, params: NODE_DEFS[n.type].family === "sensor" ? { hz: n.params?.hz ?? 200 } : {} as Record<string,number> })).sort((a,b) => compare(a.id,b.id)),
    edges: graph.edges.map(e => ({ from:e.from, to:e.to, mode: "LATEST" as const })).sort((a,b) => compare(a.from + ">" + a.to,b.from + ">" + b.to)) };
  const modules: Record<string,string> = {}; const lockfile: SourcePackage["lockfile"] = {};
  for (const slug of [...new Set(clean.nodes.map(n => NODE_DEFS[n.type].module).filter((s): s is string => !!s))].sort(compare)) {
    const raw = await load(slug); const block = JSON.parse(raw) as BlockJson; validateBlock(block);
    if (block.name.toLowerCase() !== slug || block.version !== "1.0.0") throw new Error("Unexpected module identity: " + slug);
    modules[slug] = raw; lockfile[slug] = { version:block.version, digest:await digest(raw) };
  }
  const runtimePlan = { order:result.schedule, delivery:"LATEST tick-batched", arbitration:"safety-override-v1", estimatedCriticalPathMs:result.estimatedCriticalPathMs, executable:false as const };
  const stackId = await digest(canonical({ runtime:RUNTIME, nodes:clean.nodes, edges:clean.edges, deadlineMs:clean.deadlineMs, lockfile, runtimePlan }));
  return { format:"synapsevm.source-package.v1", manifest:{kind:"NeuroStack",name:clean.name,version:clean.version,stackId,runtime:RUNTIME,executable:false,signature:null}, graph:clean,lockfile,runtimePlan,modules };
}
export async function importPackage(raw: string): Promise<SourcePackage> {
  if (new TextEncoder().encode(raw).length > 20_000_000) throw new Error("Package exceeds 20 MB");
  const pkg = JSON.parse(raw) as SourcePackage;
  if (pkg.format !== "synapsevm.source-package.v1") throw new Error("Unsupported package format");
  const rebuilt = await compileStack(pkg.graph, async slug => { if (typeof pkg.modules?.[slug] !== "string") throw new Error("Missing module " + slug); return pkg.modules[slug]; });
  if (canonical(rebuilt) !== canonical(pkg)) throw new Error("Package integrity or canonical metadata mismatch");
  return rebuilt;
}
export async function deploymentBundle(pkg: SourcePackage, cameraHz: number) {
  if (!Number.isInteger(cameraHz) || cameraHz < 100 || cameraHz > 1000) throw new Error("Deployment unsupported: camera must provide 100–1000 Hz");
  const cameras = pkg.graph.nodes.filter(n => n.type === "EventCamera");
  if (cameras.some(n => cameraHz < (n.params?.hz ?? 200))) throw new Error("Camera rate is below the locked Stack rate");
  const data = { kind:"DeploymentBundle", version:1, stackId:pkg.manifest.stackId, target:"simulator", cameraHz, calibration:"simulator-identity-v1", fallback:"STOP", status:"configuration-only", verification:{profile:"local",rawReplay:"private"} };
  return { ...data, deploymentId:await digest(canonical(data)) };
}
