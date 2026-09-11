// apps/neurolab-web/lib/synapseVm.ts
function validateBlock(block) {
  const n = block.neuronCount;
  const int32 = (v) => Number.isInteger(v) && v >= -2147483648 && v <= 2147483647;
  const neuron = (v) => Number.isInteger(v) && v >= 0 && v < n;
  if (!Number.isInteger(n) || n <= 0 || n > 1e6) throw new Error("Invalid neuron count");
  if (block.csrOffsets.length !== n + 1 || block.csrOffsets[0] !== 0 || block.csrPres.length !== block.csrWeights.length || block.csrOffsets[n] !== block.csrPres.length || block.csrOffsets.some((v, i, a) => !Number.isInteger(v) || v < 0 || v > block.csrPres.length || i > 0 && v < a[i - 1])) throw new Error("Invalid CSR topology");
  if (!block.csrPres.every(neuron) || !block.csrWeights.every(int32) || ![block.leak, block.threshold, block.reset, block.triggerThreshold].every(int32)) throw new Error("Invalid model parameters");
  if (new Set(block.inputChannels.map((c) => c.name)).size !== block.inputChannels.length || block.inputChannels.some((c) => !c.name || !c.targets.every(neuron)) || Object.values(block.outputChannels).some((ids) => !ids.every(neuron))) throw new Error("Invalid channel mapping");
}
var ONE = 1 << 16;
function satAdd(a, b) {
  const s = a + b;
  if (s > 2147483647) return 2147483647;
  if (s < -2147483648) return -2147483648 | 0;
  return s | 0;
}
function mul(a, b) {
  const shifted = BigInt(a) * BigInt(b) >> 16n;
  return Number(shifted > 2147483647n ? 2147483647n : shifted < -2147483648n ? -2147483648n : shifted);
}
function q16(v) {
  if (!Number.isFinite(v)) throw new Error("Q16 requires a finite number");
  const scaled = Math.sign(v) * Math.round(Math.abs(v) * ONE);
  return Math.max(-2147483648, Math.min(2147483647, scaled));
}
var SynapseVmJs = class {
  block;
  v;
  spikes;
  tick = 0;
  constructor(block) {
    validateBlock(block);
    this.block = structuredClone(block);
    this.v = new Int32Array(block.neuronCount);
    this.spikes = new Uint8Array(block.neuronCount);
  }
  reset() {
    this.v.fill(0);
    this.spikes.fill(0);
    this.tick = 0;
  }
  snapshot() {
    const buf = new ArrayBuffer(12 + this.block.neuronCount * 5);
    const view = new DataView(buf);
    view.setBigUint64(0, BigInt(this.tick), true);
    view.setUint32(8, this.block.neuronCount, true);
    let off = 12;
    for (let i = 0; i < this.block.neuronCount; i++) {
      view.setInt32(off, this.v[i], true);
      view.setUint8(off + 4, this.spikes[i]);
      off += 5;
    }
    return new Uint8Array(buf);
  }
  restore(bytes) {
    if (bytes.length !== 12 + this.block.neuronCount * 5) throw new Error("Invalid snapshot length");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tick = view.getBigUint64(0, true);
    if (view.getUint32(8, true) !== this.block.neuronCount || tick > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Invalid snapshot header");
    const v = new Int32Array(this.v.length);
    const spikes = new Uint8Array(this.spikes.length);
    for (let i = 0; i < v.length; i++) {
      v[i] = view.getInt32(12 + i * 5, true);
      spikes[i] = view.getUint8(16 + i * 5);
      if (spikes[i] > 1) throw new Error("Invalid spike byte");
    }
    this.tick = Number(tick);
    this.v = v;
    this.spikes = spikes;
  }
  step(input, tick) {
    if (input.length !== this.block.inputChannels.length || input.some((v) => !Number.isInteger(v) || v < -2147483648 || v > 2147483647)) throw new Error("Input must contain one int32 per channel");
    if (!Number.isSafeInteger(tick) || tick < 0) throw new Error("Tick must be a nonnegative safe integer");
    const n = this.block.neuronCount;
    const currents = new Int32Array(n);
    this.tick = tick;
    this.block.inputChannels.forEach((ch, slot) => {
      const val = input[slot] | 0;
      for (const nid of ch.targets) if (nid < n) currents[nid] = satAdd(currents[nid], val);
    });
    const loomIdx = this.block.inputChannels.findIndex((c) => c.name === "loom");
    if (loomIdx >= 0 && input[loomIdx] >= q16(0.15)) {
      const loom = input[loomIdx];
      for (const nid of this.block.outputChannels.trigger) currents[nid] = satAdd(currents[nid], satAdd(loom, q16(0.5)));
      for (const nid of this.block.outputChannels.danger) currents[nid] = satAdd(currents[nid], loom);
    }
    const peak = input.length ? Math.max(...input) : 0;
    if (peak >= q16(0.25)) {
      for (const nid of this.block.outputChannels.danger) currents[nid] = satAdd(currents[nid], peak);
      for (const nid of this.block.outputChannels.trigger) currents[nid] = satAdd(currents[nid], Math.trunc(peak / 2));
    }
    for (let post = 0; post < n; post++) {
      const start = this.block.csrOffsets[post];
      const end = this.block.csrOffsets[post + 1];
      let syn = 0;
      for (let e = start; e < end; e++) {
        const pre = this.block.csrPres[e];
        if (this.spikes[pre]) syn = satAdd(syn, this.block.csrWeights[e]);
      }
      currents[post] = satAdd(currents[post], syn);
    }
    const next = new Uint8Array(n);
    let fired = 0;
    const trace = [];
    for (let i = 0; i < n; i++) {
      let v = satAdd(mul(this.v[i], this.block.leak), currents[i]);
      if (v >= this.block.threshold) {
        next[i] = 1;
        v = this.block.reset;
        fired++;
        trace.push(i);
      }
      this.v[i] = v;
    }
    this.spikes = next;
    const rate = (ids) => {
      if (!ids.length) return 0;
      let sum = 0;
      for (const id of ids) if (this.spikes[id]) sum = satAdd(sum, ONE);
      return sum / ids.length | 0;
    };
    const left = rate(this.block.outputChannels.avoidLeft);
    const right = rate(this.block.outputChannels.avoidRight);
    const danger = satAdd(rate(this.block.outputChannels.danger), rate(this.block.outputChannels.trigger));
    const triggerNeuronIds = this.block.outputChannels.trigger.filter((id) => this.spikes[id] === 1);
    const dangerNeuronIds = this.block.outputChannels.danger.filter((id) => this.spikes[id] === 1);
    const triggerSpikes = triggerNeuronIds.length > 0;
    const trigger = triggerSpikes || danger >= this.block.triggerThreshold || danger >= q16(0.1);
    return {
      danger,
      avoidX: right - left,
      avoidY: rate(this.block.outputChannels.avoidY),
      trigger,
      firedCount: fired,
      traceNeuronIds: trace,
      triggerNeuronIds,
      dangerNeuronIds,
      voltages: Array.from(this.v.slice(0, 48))
    };
  }
};

// apps/neurolab-web/lib/stackCompiler.ts
var RUNTIME = "synapsevm-fixed-v1";
var NODE_DEFS = {
  EventCamera: { family: "sensor", inputs: {}, outputs: { events: "EventVision/v1" }, estimatedMs: 1, priority: 0 },
  IMU: { family: "sensor", inputs: {}, outputs: { heading: "HeadingDelta/v1" }, estimatedMs: 0.2, priority: 0 },
  LoomGuard: { family: "neuroblock", inputs: { event_vision: "EventVision/v1" }, outputs: { avoidance_vector: "AvoidanceSignal/v1" }, estimatedMs: 2, priority: 0, module: "loomguard" },
  FlowSense: { family: "neuroblock", inputs: { event_vision: "EventVision/v1" }, outputs: { optic_flow: "OpticFlow/v1" }, estimatedMs: 2, priority: 2, module: "flowsense" },
  TargetTrack: { family: "neuroblock", inputs: { event_vision: "EventVision/v1" }, outputs: { target_bearing: "TargetBearing/v1" }, estimatedMs: 2, priority: 2, module: "targettrack" },
  HeadingCell: { family: "neuroblock", inputs: { optic_flow: "OpticFlow/v1", target_bearing: "TargetBearing/v1", heading_delta: "HeadingDelta/v1" }, outputs: { steering_command: "SteeringCommand/v1" }, estimatedMs: 1, priority: 1, module: "headingcell" },
  Arbiter: { family: "control", inputs: { nominal: "SteeringCommand/v1", override: "AvoidanceSignal/v1" }, outputs: { command: "ControlVector/v1" }, estimatedMs: 0.1, priority: 0 },
  DroneControl: { family: "actuator", inputs: { control: "ControlVector/v1" }, outputs: {}, estimatedMs: 0.5, priority: 0 }
};
var compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
function canonical(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (typeof value === "object" && value !== null) return "{" + Object.keys(value).sort(compare).map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  throw new Error("Only finite JSON values are supported");
}
async function digest(bytes) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bytes));
  return "sha256:" + Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
function validateGraph(graph) {
  const errors = [];
  const fail = (code, message) => errors.push({ code, message });
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new Error("Invalid Stack graph");
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(graph.name) || !/^\d+\.\d+\.\d+$/.test(graph.version)) fail("METADATA", "Use a simple Stack name and a three-part version");
  if (!Number.isFinite(graph.deadlineMs) || graph.deadlineMs <= 0) fail("TIMING", "Deadline must be positive");
  const nodes = /* @__PURE__ */ new Map();
  for (const node of graph.nodes) {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(node.id) || nodes.has(node.id)) fail("NODE", "Invalid or duplicate node ID: " + node.id);
    if (!Object.hasOwn(NODE_DEFS, node.type)) fail("NODE", "Unsupported node: " + node.type);
    if (Object.entries(node.params ?? {}).some(([k, v]) => k !== "hz" || NODE_DEFS[node.type]?.family !== "sensor" || !Number.isInteger(v) || v <= 0 || v > 1e3)) fail("PARAMETER", "Only sensor hz (1\u20131000) is supported: " + node.id);
    nodes.set(node.id, node);
  }
  if (errors.some((e) => e.code === "NODE")) return { errors, schedule: [], estimatedCriticalPathMs: 0 };
  const incoming = /* @__PURE__ */ new Map();
  const successors = new Map(graph.nodes.map((n) => [n.id, []]));
  const indegree = new Map(graph.nodes.map((n) => [n.id, 0]));
  for (const edge of graph.edges) {
    const [src, out, extraOut] = edge.from.split(".");
    const [dst, port, extraIn] = edge.to.split(".");
    const a = nodes.get(src), b = nodes.get(dst);
    const output = a && NODE_DEFS[a.type]?.outputs[out];
    const input = b && NODE_DEFS[b.type]?.inputs[port];
    if (extraOut || extraIn || !output || !input || output !== input) {
      fail("TYPE", edge.from + " \u2192 " + edge.to + ": incompatible or missing typed port");
      continue;
    }
    if (edge.mode && edge.mode !== "LATEST") fail("DELIVERY", "Only LATEST tick-batched delivery is implemented");
    const writers = incoming.get(edge.to) ?? [];
    writers.push(src);
    incoming.set(edge.to, writers);
    if (writers.length > 1) fail("WRITERS", edge.to + " has multiple writers; use an explicit arbiter");
    successors.get(src).push(dst);
    indegree.set(dst, indegree.get(dst) + 1);
  }
  for (const node of graph.nodes) {
    for (const port of Object.keys(NODE_DEFS[node.type]?.inputs ?? {})) if (!incoming.has(node.id + "." + port)) fail("MISSING_INPUT", node.id + "." + port + " has no source");
  }
  if (!graph.nodes.some((n) => NODE_DEFS[n.type]?.family === "actuator")) fail("ACTUATOR", "Add a final actuator command node");
  const ready = graph.nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id);
  const schedule = [];
  const latency = /* @__PURE__ */ new Map();
  const rates = /* @__PURE__ */ new Map();
  while (ready.length) {
    ready.sort((a, b) => (NODE_DEFS[nodes.get(a).type]?.priority ?? 4) - (NODE_DEFS[nodes.get(b).type]?.priority ?? 4) || compare(a, b));
    const id = ready.shift();
    const node = nodes.get(id);
    const def2 = NODE_DEFS[node.type];
    schedule.push(id);
    const parents = Object.keys(def2?.inputs ?? {}).flatMap((p) => incoming.get(id + "." + p) ?? []);
    latency.set(id, Math.max(0, ...parents.map((p) => latency.get(p) ?? 0)) + (def2?.estimatedMs ?? 0));
    rates.set(id, def2?.family === "sensor" ? node.params?.hz ?? 200 : Math.min(...parents.map((p) => rates.get(p) ?? 0)));
    if (node.type === "LoomGuard" && (rates.get(id) ?? 0) < 100) fail("ENVELOPE", "LoomGuard requires at least 100 Hz; source provides " + rates.get(id) + " Hz");
    for (const next of successors.get(id) ?? []) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) ready.push(next);
    }
  }
  if (schedule.length !== graph.nodes.length) fail("CYCLE", "Implicit cycle detected; state/delay nodes are not supported in this compiler version");
  const estimatedCriticalPathMs = Math.max(0, ...latency.values());
  if (estimatedCriticalPathMs > graph.deadlineMs) fail("DEADLINE", "Estimated path " + estimatedCriticalPathMs + " ms exceeds deadline " + graph.deadlineMs + " ms");
  return { errors, schedule, estimatedCriticalPathMs };
}
async function compileStack(graph, load) {
  const result = validateGraph(graph);
  if (result.errors.length) throw new Error(result.errors.map((e) => e.code + ": " + e.message).join("\n"));
  const clean = {
    name: graph.name,
    version: graph.version,
    deadlineMs: graph.deadlineMs,
    nodes: graph.nodes.map((n) => ({ id: n.id, type: n.type, params: NODE_DEFS[n.type].family === "sensor" ? { hz: n.params?.hz ?? 200 } : {} })).sort((a, b) => compare(a.id, b.id)),
    edges: graph.edges.map((e) => ({ from: e.from, to: e.to, mode: "LATEST" })).sort((a, b) => compare(a.from + ">" + a.to, b.from + ">" + b.to))
  };
  const modules = {};
  const lockfile = {};
  for (const slug of [...new Set(clean.nodes.map((n) => NODE_DEFS[n.type].module).filter((s) => !!s))].sort(compare)) {
    const raw = await load(slug);
    const block = JSON.parse(raw);
    validateBlock(block);
    if (block.name.toLowerCase() !== slug || block.version !== "1.0.0") throw new Error("Unexpected module identity: " + slug);
    modules[slug] = raw;
    lockfile[slug] = { version: block.version, digest: await digest(raw) };
  }
  const runtimePlan = { order: result.schedule, delivery: "LATEST tick-batched", arbitration: "safety-override-v1", estimatedCriticalPathMs: result.estimatedCriticalPathMs, executable: false };
  const stackId = await digest(canonical({ runtime: RUNTIME, nodes: clean.nodes, edges: clean.edges, deadlineMs: clean.deadlineMs, lockfile, runtimePlan }));
  return { format: "synapsevm.source-package.v1", manifest: { kind: "NeuroStack", name: clean.name, version: clean.version, stackId, runtime: RUNTIME, executable: false, signature: null }, graph: clean, lockfile, runtimePlan, modules };
}
async function importPackage(raw) {
  if (new TextEncoder().encode(raw).length > 2e7) throw new Error("Package exceeds 20 MB");
  const pkg = JSON.parse(raw);
  if (pkg.format !== "synapsevm.source-package.v1") throw new Error("Unsupported package format");
  const rebuilt = await compileStack(pkg.graph, async (slug) => {
    if (typeof pkg.modules?.[slug] !== "string") throw new Error("Missing module " + slug);
    return pkg.modules[slug];
  });
  if (canonical(rebuilt) !== canonical(pkg)) throw new Error("Package integrity or canonical metadata mismatch");
  return rebuilt;
}

// apps/neurolab-web/lib/composeCompiler.ts
var ENGINE = "synapsevm-compose-js-v1";
var def = (family, inputs, outputs, description, extra = {}) => ({ family, inputs, outputs, description, hz: 200, ms: 0.1, priority: 1, stateful: false, params: {}, ...extra });
var event = "EventVision/v1";
var avoid = "AvoidanceSignal/v1";
var control = "ControlVector/v1";
var steer = "SteeringCommand/v1";
var DEFINITIONS = {
  WorldState: def("sensor", {}, { world: "WorldState/v1" }, "Recorded simulator features: obstacle proximity and looming, in Q16.16.", { ms: 0.2, priority: 0 }),
  WorldToEvents: def("adapter", { world: "WorldState/v1" }, { events: event }, "Explicit simulator feature encoder. Maps proximity and looming to four neural input channels.", { ms: 0.3, priority: 0 }),
  EventCamera: def("sensor", {}, { events: event }, "Pre-encoded features [depth_front, depth_left, depth_right, loom]. Not raw camera frames.", { ms: 1, priority: 0 }),
  IMU: def("sensor", {}, { heading: "HeadingDelta/v1" }, "Recorded yaw delta in Q16.16.", { ms: 0.2 }),
  SteeringInput: def("sensor", {}, { steering: steer }, "Recorded nominal steering and visibility. Conventional input, not a neural model."),
  LoomGuard: def("neuroblock", { event_vision: event }, { avoidance_vector: avoid }, "Runs the exact locked LoomGuard model bytes with the fixed-point neural runtime.", { ms: 2, priority: 0, stateful: true, module: "loomguard" }),
  Arbiter: def("control", { nominal: steer, override: avoid }, { command: control }, "Safety override wins when triggered or danger meets the configured threshold; otherwise use nominal steering.", { priority: 0, params: { threshold: { value: 52429, min: 0, max: 131072, label: "Danger threshold \xB7 Q16" }, speed: { value: 32768, min: 0, max: 65536, label: "Nominal speed \xB7 Q16" } } }),
  SafetyGate: def("control", { safety: avoid }, { command: control }, "Stop forward motion on a neural trigger or danger threshold. Preserve the neural avoidance direction.", { priority: 0, params: { threshold: { value: 52429, min: 0, max: 131072, label: "Danger threshold \xB7 Q16" }, speed: { value: 32768, min: 0, max: 65536, label: "Cruise speed \xB7 Q16" } } }),
  BrakeDecoder: def("adapter", { control }, { brake: "BrakeCommand/v1" }, "Map emergency or zero-speed commands to full brake.", { priority: 0 }),
  Clamp: def("control", { control }, { command: control }, "Limit steering magnitude; preserve speed and emergency flag.", { params: { limit: { value: 32768, min: 0, max: 65536, label: "Steering limit \xB7 Q16" } } }),
  PreviousValue: def("state", { control }, { previous: control }, "One scheduled-update delay. Initial output is STOP. Input is committed after the current graph step.", { stateful: true, priority: 0 }),
  DroneControl: def("actuator", { control }, {}, "Simulated drone command: steer, speed and emergency.", { ms: 0.5, priority: 0 }),
  RoverSteering: def("actuator", { control }, {}, "Simulated rover command: steer, speed and emergency.", { ms: 0.5, priority: 0 }),
  CarBrake: def("actuator", { brake: "BrakeCommand/v1" }, {}, "Simulated brake command. No physical vehicle driver.", { ms: 0.5, priority: 0 })
};
for (const type of ["FlowSense", "HeadingCell", "TargetTrack"]) {
  const d = NODE_DEFS[type];
  DEFINITIONS[type] = def("neuroblock", d.inputs, d.outputs, "Source interface from the building-block specification.", { module: d.module, ms: d.estimatedMs, priority: d.priority, stateful: true, unsupported: "The bundled model exposes the shared reflex decoder, not this declared " + Object.values(d.outputs).join(", ") + " interface." });
}
var RATES = [25, 50, 100, 125, 200, 250, 500, 1e3];
function paramsFor(n) {
  const d = DEFINITIONS[n.type];
  return { hz: d.hz, ...Object.fromEntries(Object.entries(d.params).map(([k, v]) => [k, v.value])), ...n.params };
}
function moduleKey(n) {
  return n.module ? n.module.id + "@" + n.module.version : DEFINITIONS[n.type].module;
}
var idPattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
var record = (v) => !!v && typeof v === "object" && !Array.isArray(v);
function checkGraph(value) {
  const errors = [], warnings = [], blocked = [];
  const fail = (code, message, node, edge) => errors.push({ code, message, ...node ? { node } : {}, ...edge !== void 0 ? { edge } : {} });
  const empty = { errors, warnings, blocked, order: [], estimatedMs: 0 };
  if (!record(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    fail("GRAPH", "Expected a graph with nodes and edges.");
    return empty;
  }
  const g = value;
  if (!idPattern.test(g.name) || typeof g.name !== "string" || typeof g.version !== "string" || !/^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/.test(g.version)) fail("IDENTITY", "Use a simple name and major.minor.patch version.");
  if (!["FAST", "AUDIT", "DEBUG"].includes(g.policy)) fail("POLICY", "Select FAST, AUDIT or DEBUG.");
  if (!Number.isFinite(g.deadlineMs) || g.deadlineMs <= 0 || g.deadlineMs > 1e3) fail("DEADLINE", "Deadline must be between 0 and 1000 ms.");
  if (g.nodes.length < 1 || g.nodes.length > 64 || g.edges.length > 256) {
    fail("LIMIT", "Use 1\u201364 nodes and at most 256 connections.");
    return empty;
  }
  const nodes = /* @__PURE__ */ new Map();
  for (const raw of g.nodes) {
    if (!record(raw) || typeof raw.id !== "string" || !idPattern.test(raw.id) || nodes.has(raw.id) || typeof raw.type !== "string" || !Object.hasOwn(DEFINITIONS, raw.type)) {
      fail("NODE", "Invalid, unknown or duplicate node.");
      continue;
    }
    const n = raw, d = DEFINITIONS[n.type];
    nodes.set(n.id, n);
    if (n.params !== void 0 && (!record(n.params) || Object.entries(n.params).some(([k, v]) => !Number.isInteger(v) || (k === "hz" ? !RATES.includes(v) : !Object.hasOwn(d.params, k) || v < d.params[k].min || v > d.params[k].max)))) fail("PARAMETER", "Unsupported parameter or value on " + n.id, n.id);
    if (n.module && (!d.module || !record(n.module) || typeof n.module.id !== "string" || !/^[-a-z0-9_]+\/[-a-z0-9_]+$/.test(n.module.id) || typeof n.module.version !== "string" || !/^\d+\.\d+\.\d+$/.test(n.module.version) || !/^sha256:[a-f0-9]{64}$/.test(n.module.digest))) fail("MODULE", "Invalid pinned module reference.", n.id);
    if (d.unsupported) blocked.push({ code: "ABI", node: n.id, message: n.id + ": " + d.unsupported });
  }
  if (errors.some((e) => e.code === "NODE" || e.code === "PARAMETER" || e.code === "MODULE")) return empty;
  const writers = /* @__PURE__ */ new Map(), next = new Map(g.nodes.map((n) => [n.id, []])), indegree = new Map(g.nodes.map((n) => [n.id, 0]));
  for (const [i, e] of g.edges.entries()) {
    if (!record(e) || typeof e.from !== "string" || typeof e.to !== "string") {
      fail("EDGE", "Malformed connection.", void 0, i);
      continue;
    }
    const a = e.from.split("."), b = e.to.split("."), src = nodes.get(a[0]), dst = nodes.get(b[0]);
    const out = src && Object.hasOwn(DEFINITIONS[src.type].outputs, a[1]) && DEFINITIONS[src.type].outputs[a[1]], input = dst && Object.hasOwn(DEFINITIONS[dst.type].inputs, b[1]) && DEFINITIONS[dst.type].inputs[b[1]];
    if (a.length !== 2 || b.length !== 2 || !out || !input || out !== input) {
      fail("TYPE", e.from + " \u2192 " + e.to + ": incompatible ports.", b[0], i);
      continue;
    }
    if (e.mode !== void 0 && e.mode !== "LATEST") fail("DELIVERY", "Only explicit LATEST delivery is implemented.", void 0, i);
    if (writers.has(e.to)) fail("WRITERS", e.to + " already has a source. Insert an arbiter.", b[0], i);
    writers.set(e.to, a[0]);
    if (dst.type !== "PreviousValue") {
      next.get(a[0]).push(b[0]);
      indegree.set(b[0], indegree.get(b[0]) + 1);
    }
  }
  for (const n of g.nodes) {
    const d = DEFINITIONS[n.type];
    for (const p of Object.keys(d.inputs)) if (!writers.has(n.id + "." + p)) fail("MISSING_INPUT", n.id + "." + p + " needs a source.", n.id);
    if (d.family !== "actuator" && !g.edges.some((e) => record(e) && typeof e.from === "string" && e.from.startsWith(n.id + "."))) warnings.push({ code: "UNUSED", node: n.id, message: n.id + " does not feed another node." });
    if (n.type === "LoomGuard" && paramsFor(n).hz < 100) fail("RATE", "LoomGuard requires at least 100 Hz.", n.id);
  }
  if (!g.nodes.some((n) => DEFINITIONS[n.type].family === "actuator")) fail("ACTUATOR", "Add an actuator.");
  const ready = g.nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id), order = [], latency = /* @__PURE__ */ new Map(), effectiveRate = /* @__PURE__ */ new Map();
  while (ready.length) {
    ready.sort((a, b) => DEFINITIONS[nodes.get(a).type].priority - DEFINITIONS[nodes.get(b).type].priority || (a < b ? -1 : 1));
    const id = ready.shift(), n = nodes.get(id), d = DEFINITIONS[n.type];
    order.push(id);
    const parents = n.type === "PreviousValue" ? [] : Object.keys(d.inputs).map((p) => writers.get(id + "." + p)).filter((p) => !!p);
    latency.set(id, Math.max(0, ...parents.map((p) => latency.get(p) ?? 0)) + d.ms);
    effectiveRate.set(id, Math.min(paramsFor(n).hz, ...parents.map((p) => effectiveRate.get(p) ?? paramsFor(n).hz)));
    if (n.type === "LoomGuard" && effectiveRate.get(id) < 100) fail("RATE", id + " receives fresh sensor data below 100 Hz through its adapters.", id);
    for (const parent of parents) {
      const src = nodes.get(parent);
      if (paramsFor(src).hz < paramsFor(n).hz) warnings.push({ code: "HELD_INPUT", node: id, message: id + " runs at " + paramsFor(n).hz + " Hz and holds " + parent + "'s " + paramsFor(src).hz + " Hz values." });
      if (n.type === "LoomGuard" && paramsFor(src).hz < 100) fail("RATE", id + " receives less than 100 Hz.", id);
    }
    for (const dst of next.get(id)) {
      indegree.set(dst, indegree.get(dst) - 1);
      if (indegree.get(dst) === 0) ready.push(dst);
    }
  }
  if (order.length !== g.nodes.length) fail("CYCLE", "Implicit cycle. Route feedback through PreviousValue.");
  const estimatedMs = Math.round(Math.max(0, ...latency.values()) * 1e3) / 1e3;
  if (estimatedMs > g.deadlineMs) fail("DEADLINE", "Estimated critical path " + estimatedMs + " ms exceeds " + g.deadlineMs + " ms.");
  return { errors, warnings, blocked, order, estimatedMs };
}
async function buildStack(g, load) {
  const c = checkGraph(g);
  if (c.errors.length) throw Error(c.errors.map((e) => e.message).join("\n"));
  const graph = { name: g.name, version: g.version, deadlineMs: g.deadlineMs, policy: g.policy, nodes: g.nodes.map((n) => ({ id: n.id, type: n.type, params: paramsFor(n), ...n.module ? { module: { ...n.module } } : {} })).sort((a, b) => a.id < b.id ? -1 : 1), edges: g.edges.map((e) => ({ from: e.from, to: e.to, mode: "LATEST" })).sort((a, b) => a.from + ">" + a.to < b.from + ">" + b.to ? -1 : 1) };
  const modules = {}, lockfile = {};
  for (const n of graph.nodes.filter((n2) => DEFINITIONS[n2.type].module)) {
    const key = moduleKey(n);
    if (Object.hasOwn(modules, key)) {
      if (n.module && lockfile[key].digest !== n.module.digest) throw Error("Conflicting module locks: " + key);
      continue;
    }
    const raw = await load(key);
    if (new TextEncoder().encode(raw).length > 4e6) throw Error("Module exceeds 4 MB.");
    const b = JSON.parse(raw);
    validateBlock(b);
    if (b.neuronCount > 1e4 || b.csrPres.length > 2e5) throw Error("Module exceeds browser execution limits.");
    const hash = await digest(raw);
    if (n.module ? hash !== n.module.digest : b.name.toLowerCase() !== key || b.version !== "1.0.0") throw Error("Locked module identity mismatch: " + key);
    if (n.type === "LoomGuard" && canonical(b.inputChannels.map((c2) => c2.name)) !== canonical(["depth_front", "depth_left", "depth_right", "loom"])) throw Error("LoomGuard requires the four-channel feature ABI.");
    modules[key] = raw;
    lockfile[key] = { version: n.module?.version ?? b.version, digest: hash };
  }
  const executable = c.blocked.length === 0, runtimePlan = { order: c.order, clockHz: 1e3, periods: Object.fromEntries(graph.nodes.map((n) => [n.id, 1e3 / paramsFor(n).hz])), delivery: "LATEST", stateCommit: "AFTER_TICK", estimatedCriticalPathMs: c.estimatedMs, executable };
  const verification = { policy: graph.policy, scope: "local-unsigned-replay", artifactVerifier: "synapsevm-artifact-verifier-v1", replayVerifier: "synapsevm-compose-verifier-v1", receiptFormat: "synapsevm.stack-receipt.v1", external: { protocol: "chainlink-cre", requestFormat: "synapsevm.cre-validation-request.v1", workflow: "synapsevm-neuroproof-v1", status: "not-run" } };
  const stackId = await digest(canonical({ runtime: ENGINE, graph: { nodes: graph.nodes, edges: graph.edges, deadlineMs: graph.deadlineMs, policy: graph.policy }, lockfile, runtimePlan, verification }));
  return { format: "synapsevm.compose-package.v1", manifest: { kind: "NeuroStack", name: graph.name, version: graph.version, stackId, runtime: ENGINE, executable, signature: null }, graph, lockfile, modules, runtimePlan, verification };
}
async function importStack(raw) {
  if (new TextEncoder().encode(raw).length > 2e7) throw Error("Package exceeds 20 MB.");
  const p = JSON.parse(raw);
  if (p?.format === "synapsevm.source-package.v1") {
    const legacy = await importPackage(raw);
    return buildStack({ ...legacy.graph, policy: "AUDIT" }, async (k) => legacy.modules[k]);
  }
  if (p?.format !== "synapsevm.compose-package.v1") throw Error("Unsupported Stack package.");
  const rebuilt = await buildStack(p.graph, async (key) => {
    if (typeof p.modules?.[key] !== "string") throw Error("Missing module " + key);
    return p.modules[key];
  });
  if (canonical(p) !== canonical(rebuilt)) {
    const legacyVerification = p?.verification;
    const legacyShape = record(legacyVerification) && legacyVerification.policy === rebuilt.graph.policy && legacyVerification.scope === "local-unsigned-replay" && Object.keys(legacyVerification).sort().join(",") === "policy,scope";
    if (!legacyShape) throw Error("Package integrity mismatch.");
    const legacy = structuredClone(rebuilt);
    legacy.verification = { policy: rebuilt.graph.policy, scope: "local-unsigned-replay" };
    legacy.manifest.stackId = await digest(canonical({ runtime: ENGINE, graph: { nodes: legacy.graph.nodes, edges: legacy.graph.edges, deadlineMs: legacy.graph.deadlineMs, policy: legacy.graph.policy }, lockfile: legacy.lockfile, runtimePlan: legacy.runtimePlan, verification: legacy.verification }));
    if (canonical(p) !== canonical(legacy)) throw Error("Package integrity mismatch.");
    return legacy;
  }
  return rebuilt;
}

// apps/neurolab-web/lib/composeRuntime.ts
var int = (x) => Number.isInteger(x) && x >= -2147483648 && x <= 2147483647;
var signal = (kind, ...values) => ({ kind, values });
var stop = () => signal("ControlVector/v1", 0, 0, 0);
var emergency = (s) => s.kind === "BrakeCommand/v1" ? s.values[0] > 0 : !!s.values[2];
function validateSignal(s, kind) {
  const lengths = { "WorldState/v1": 4, "EventVision/v1": 4, "HeadingDelta/v1": 1, "SteeringCommand/v1": 2, "AvoidanceSignal/v1": 4, "ControlVector/v1": 3, "BrakeCommand/v1": 1 };
  if (!s || s.kind !== kind || !Array.isArray(s.values) || s.values.length !== lengths[kind] || !s.values.every(int)) throw Error("Invalid " + kind + " signal.");
  if (["WorldState/v1", "EventVision/v1"].includes(kind) && s.values.some((v) => v < 0 || v > 65536)) throw Error("Sensor features must be Q16 values between 0 and 65536.");
  if (kind === "SteeringCommand/v1" && (Math.abs(s.values[0]) > 65536 || ![0, 1].includes(s.values[1]))) throw Error("Steering input requires [-65536,65536] steer and 0/1 visibility.");
}
var CompiledStack = class {
  pkg;
  packageHash;
  vms = /* @__PURE__ */ new Map();
  busy = false;
  state = { tick: 0, neurons: {}, values: {}, delays: {}, lastActions: {}, receiptSequence: 0, previousReceiptHash: null };
  constructor(pkg) {
    this.pkg = structuredClone(pkg);
    this.packageHash = digest(canonical(this.pkg));
    if (!pkg.manifest.executable) throw Error("This package has unresolved runtime interfaces. It is source-only.");
    for (const n of pkg.graph.nodes) {
      if (DEFINITIONS[n.type].module) this.vms.set(n.id, new SynapseVmJs(JSON.parse(pkg.modules[moduleKey(n)])));
      if (n.type === "PreviousValue") this.state.delays[n.id] = stop();
    }
  }
  snapshot() {
    if (this.busy) throw Error("Runtime is stepping.");
    return this.capture();
  }
  capture() {
    return structuredClone({ ...this.state, neurons: Object.fromEntries([...this.vms].map(([id, vm]) => [id, Array.from(vm.snapshot())])) });
  }
  restore(s) {
    if (this.busy) throw Error("Runtime is stepping.");
    if (!s || !Number.isSafeInteger(s.tick) || s.tick < 0 || !Number.isSafeInteger(s.receiptSequence) || s.receiptSequence < 0 || !(s.previousReceiptHash === null || /^sha256:[a-f0-9]{64}$/.test(s.previousReceiptHash))) throw Error("Invalid Stack state.");
    if (canonical(Object.keys(s.neurons).sort()) !== canonical([...this.vms.keys()].sort())) throw Error("State modules do not match.");
    const expectedDelays = this.pkg.graph.nodes.filter((n) => n.type === "PreviousValue").map((n) => n.id).sort();
    if (canonical(Object.keys(s.delays).sort()) !== canonical(expectedDelays)) throw Error("State delays do not match.");
    for (const v of Object.values(s.delays)) validateSignal(v, "ControlVector/v1");
    for (const [port, v] of Object.entries(s.values)) {
      const [id, p] = port.split(".");
      const n = this.pkg.graph.nodes.find((n2) => n2.id === id);
      const type = n && DEFINITIONS[n.type].outputs[p];
      if (!type) throw Error("Unknown state port.");
      validateSignal(v, type);
    }
    for (const [id, v] of Object.entries(s.lastActions)) {
      const n = this.pkg.graph.nodes.find((n2) => n2.id === id);
      if (!n || DEFINITIONS[n.type].family !== "actuator") throw Error("Unknown state actuator.");
      validateSignal(v, Object.values(DEFINITIONS[n.type].inputs)[0]);
    }
    const testVms = /* @__PURE__ */ new Map();
    for (const [id, vm] of this.vms) {
      if (!Array.isArray(s.neurons[id]) || !s.neurons[id].every((v) => Number.isInteger(v) && v >= 0 && v <= 255)) throw Error("Invalid neural state bytes.");
      const temp = new SynapseVmJs(vm.block);
      temp.restore(new Uint8Array(s.neurons[id]));
      testVms.set(id, temp);
    }
    this.vms = testVms;
    this.state = structuredClone(s);
  }
  reset() {
    if (this.busy) throw Error("Runtime is stepping.");
    for (const vm of this.vms.values()) vm.reset();
    this.state = { tick: 0, neurons: {}, values: {}, delays: Object.fromEntries(this.pkg.graph.nodes.filter((n) => n.type === "PreviousValue").map((n) => [n.id, stop()])), lastActions: {}, receiptSequence: 0, previousReceiptHash: null };
  }
  async step(input) {
    if (this.busy) throw Error("Concurrent step is not supported.");
    if (!input || typeof input !== "object") throw Error("Expected recorded sensor inputs.");
    input = structuredClone(input);
    for (const n of this.pkg.graph.nodes.filter((n2) => DEFINITIONS[n2.type].family === "sensor" && this.state.tick % this.pkg.runtimePlan.periods[n2.id] === 0)) {
      validateSignal(input[n.id], Object.values(DEFINITIONS[n.type].outputs)[0]);
    }
    this.busy = true;
    const before = this.capture(), tick = this.state.tick, events = [];
    try {
      for (const id of this.pkg.runtimePlan.order) {
        if (tick % this.pkg.runtimePlan.periods[id] !== 0) continue;
        const n = this.pkg.graph.nodes.find((n2) => n2.id === id), d = DEFINITIONS[n.type], p = paramsFor(n), inputs = {}, outputs = {};
        if (n.type !== "PreviousValue") for (const port of Object.keys(d.inputs)) {
          const e = this.pkg.graph.edges.find((e2) => e2.to === id + "." + port);
          const v = this.state.values[e.from];
          if (!v) throw Error("No value available for " + id + "." + port);
          inputs[port] = structuredClone(v);
        }
        let detail = "", type = "UPDATE", view;
        if (d.family === "sensor") {
          outputs[Object.keys(d.outputs)[0]] = structuredClone(input[id]);
          detail = "Recorded sensor input";
        } else switch (n.type) {
          case "WorldToEvents":
            outputs.events = signal("EventVision/v1", ...inputs.world.values);
            detail = "Encoded four simulator features";
            break;
          case "LoomGuard":
            view = this.vms.get(id).step(inputs.event_vision.values, tick);
            outputs.avoidance_vector = signal("AvoidanceSignal/v1", view.danger, view.avoidX, view.avoidY, Number(view.trigger));
            type = view.trigger ? "TRIGGER" : "NEURAL_STEP";
            detail = view.trigger ? "Neural trigger active" : "Neural state advanced";
            break;
          case "Arbiter":
          case "SafetyGate": {
            const safety = inputs[n.type === "Arbiter" ? "override" : "safety"].values, nominal = inputs.nominal?.values ?? [0, 1], active = !!safety[3] || safety[0] >= p.threshold;
            outputs.command = signal("ControlVector/v1", active ? safety[1] : nominal[1] ? nominal[0] : 0, active ? 0 : p.speed, Number(active));
            type = active ? "SAFETY_OVERRIDE" : "NOMINAL";
            detail = active ? "Safety selected; forward speed set to zero" : nominal[1] ? "Nominal control selected" : "No visible target; maintain heading";
            break;
          }
          case "BrakeDecoder":
            outputs.brake = signal("BrakeCommand/v1", inputs.control.values[2] || inputs.control.values[1] === 0 ? 65536 : 0);
            detail = "Decoded brake command";
            break;
          case "Clamp":
            outputs.command = signal("ControlVector/v1", Math.max(-p.limit, Math.min(p.limit, inputs.control.values[0])), ...inputs.control.values.slice(1));
            detail = "Steering clamped";
            break;
          case "PreviousValue":
            outputs.previous = structuredClone(this.state.delays[id]);
            detail = "Previous scheduled value";
            break;
          case "DroneControl":
          case "RoverSteering":
          case "CarBrake":
            this.state.lastActions[id] = structuredClone(Object.values(inputs)[0]);
            type = "ACTUATOR";
            detail = emergency(this.state.lastActions[id]) ? "STOP / safety action" : "Nominal action";
            break;
          default:
            throw Error("Unsupported runtime node " + n.type);
        }
        for (const [port, v] of Object.entries(outputs)) {
          validateSignal(v, d.outputs[port]);
          this.state.values[id + "." + port] = v;
        }
        events.push({ node: id, tick, type, inputs, outputs, detail, ...view ? { moduleId: this.pkg.lockfile[moduleKey(n)].digest, fired: view.firedCount, trace: view.traceNeuronIds.slice(0, 64) } : {} });
      }
      for (const n of this.pkg.graph.nodes.filter((n2) => n2.type === "PreviousValue" && tick % this.pkg.runtimePlan.periods[n2.id] === 0)) {
        const e = this.pkg.graph.edges.find((e2) => e2.to === n.id + ".control");
        const v = this.state.values[e.from];
        if (!v) throw Error("No delayed input value.");
        this.state.delays[n.id] = structuredClone(v);
      }
      this.state.tick++;
      const actions = structuredClone(this.state.lastActions), changed = canonical(actions) !== canonical(before.lastActions), critical = changed && Object.values(actions).some(emergency);
      let receipt = null, replay = null;
      if (this.pkg.graph.policy === "DEBUG" && events.length || this.pkg.graph.policy === "AUDIT" && critical) {
        const content = { format: "synapsevm.stack-receipt.v1", stackId: this.pkg.manifest.stackId, packageHash: await this.packageHash, runtime: ENGINE, tick, sequence: this.state.receiptSequence, previousReceiptHash: this.state.previousReceiptHash, inputCommitment: await digest(canonical(input)), stateBeforeRoot: await digest(canonical(before)), stateAfterRoot: await digest(canonical(this.capture())), events, actions, signature: null };
        receipt = { ...content, hash: await digest(canonical(content)) };
        replay = { format: "synapsevm.stack-replay.v1", stackId: this.pkg.manifest.stackId, input: structuredClone(input), before, receipt };
        this.state.receiptSequence++;
        this.state.previousReceiptHash = receipt.hash;
      }
      return { tick, events, actions, receipt, replay };
    } catch (e) {
      this.busy = false;
      this.restore(before);
      throw e;
    } finally {
      this.busy = false;
    }
  }
};
async function loadCompiledStack(raw) {
  const pkg = await importStack(typeof raw === "string" ? raw : canonical(raw));
  return new CompiledStack(pkg);
}
async function replayStack(pkg, bundle) {
  if (!bundle || bundle.format !== "synapsevm.stack-replay.v1" || bundle.stackId !== pkg.manifest.stackId) throw Error("Replay belongs to a different Stack.");
  const runtime = await loadCompiledStack(pkg);
  runtime.restore(bundle.before);
  const result = await runtime.step(bundle.input);
  if (!result.receipt || canonical(result.receipt) !== canonical(bundle.receipt)) throw Error("Replay mismatch: input, state, decision, action or receipt differs.");
  return { matched: true, receiptHash: result.receipt.hash, stackId: pkg.manifest.stackId };
}
function scenarioInput(pkg, obstacle, steering = 19661) {
  return Object.fromEntries(pkg.graph.nodes.filter((n) => DEFINITIONS[n.type].family === "sensor").map((n) => [n.id, n.type === "WorldState" ? signal("WorldState/v1", obstacle ? 52429 : 0, 0, 0, obstacle ? 39322 : 0) : n.type === "EventCamera" ? signal("EventVision/v1", obstacle ? 52429 : 0, 0, 0, obstacle ? 39322 : 0) : n.type === "SteeringInput" ? signal("SteeringCommand/v1", steering, 1) : signal("HeadingDelta/v1", 0)]));
}
export {
  CompiledStack,
  loadCompiledStack,
  replayStack,
  scenarioInput
};
