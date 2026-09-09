"use client";

import Link from "next/link";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { biopilotArbiter, ComposeError, PORTS, wire, type PortType } from "@/lib/biopilot";

import { compileStack, importPackage, deploymentBundle, canonical, digest, validateGraph, NODE_DEFS, type StackGraph, type SourcePackage } from "@/lib/stackCompiler";

type Edge = { from: string; to: string; kind?: "data" | "override" };

type CanvasNode = {
  id: string;
  label: string;
  blurb: string;
  tone: "nominal" | "safety" | "arbiter";
  x: number;
  y: number;
  w: number;
  h: number;
};

type ChatMsg = { id: string; role: "user" | "assistant"; content: string };

const INITIAL_NODES: CanvasNode[] = [
  { id: "EventCamera", label: "EventCamera", blurb: "200 Hz · EventVision/v1", tone: "nominal", x: -180, y: 100, w: 180, h: 88 },
  { id: "IMU", label: "IMU", blurb: "200 Hz · HeadingDelta/v1", tone: "nominal", x: -180, y: 260, w: 180, h: 88 },
  { id: "DroneControl", label: "DroneControl", blurb: "Final actuator command", tone: "arbiter", x: 900, y: 250, w: 180, h: 88 },
  { id: "TargetTrack", label: "TargetTrack", blurb: "Select + track", tone: "nominal", x: 72, y: 88, w: 168, h: 88 },
  { id: "FlowSense", label: "FlowSense", blurb: "Optic / ego-motion", tone: "nominal", x: 72, y: 220, w: 168, h: 88 },
  { id: "LoomGuard", label: "LoomGuard", blurb: "Safety reflex", tone: "safety", x: 72, y: 360, w: 168, h: 88 },
  { id: "HeadingCell", label: "HeadingCell", blurb: "Heading + steer", tone: "nominal", x: 360, y: 180, w: 176, h: 96 },
  { id: "Arbiter", label: "Arbiter", blurb: "Priority merge", tone: "arbiter", x: 640, y: 250, w: 176, h: 96 },
];

const DEFAULT_EDGES: Edge[] = [
  { from: "EventCamera.events", to: "LoomGuard.event_vision", kind: "data" },
  { from: "EventCamera.events", to: "FlowSense.event_vision", kind: "data" },
  { from: "EventCamera.events", to: "TargetTrack.event_vision", kind: "data" },
  { from: "IMU.heading", to: "HeadingCell.heading_delta", kind: "data" },
  { from: "Arbiter.command", to: "DroneControl.control", kind: "data" },
  { from: "FlowSense.optic_flow", to: "HeadingCell.optic_flow", kind: "data" },
  { from: "TargetTrack.target_bearing", to: "HeadingCell.target_bearing", kind: "data" },
  { from: "HeadingCell.steering_command", to: "Arbiter.nominal", kind: "data" },
  { from: "LoomGuard.avoidance_vector", to: "Arbiter.override", kind: "override" },
];

const LEGAL_WIRES: { from: [string, PortType]; to: [string, PortType] }[] = [
  { from: ["FlowSense", "optic_flow"], to: ["HeadingCell", "optic_flow"] },
  { from: ["TargetTrack", "target_bearing"], to: ["HeadingCell", "target_bearing"] },
];

const PALETTE = [
  { id: "LoomGuard", tone: "safety" as const, blurb: "Looming hard override", short: "Loom" },
  { id: "FlowSense", tone: "nominal" as const, blurb: "Self-motion estimate", short: "Flow" },
  { id: "HeadingCell", tone: "nominal" as const, blurb: "Heading + steer", short: "Heading" },
  { id: "TargetTrack", tone: "nominal" as const, blurb: "Small-target lock", short: "Track" },
  { id: "Arbiter", tone: "arbiter" as const, blurb: "Priority-aware merge", short: "Arbiter" },
];

const CHAT_SUGGESTIONS = [
  { label: "Wire LoomGuard", text: "How should I wire LoomGuard into the Arbiter?" },
  { label: "Priorities", text: "Explain BioPilot priority rules for hard override" },
  { label: "Illegal wire", text: "Show me an illegal port connection example" },
  { label: "Add FlowSense", text: "Add FlowSense and connect optic_flow to HeadingCell" },
  { label: "Sim Lab", text: "What should I test first in Sim Lab?" },
];

function portAnchor(nodes: CanvasNode[], block: string, side: "out" | "in") {
  const n = nodes.find((x) => x.id === block);
  if (!n) return { x: 0, y: 0 };
  return {
    x: side === "out" ? n.x + n.w : n.x,
    y: n.y + n.h / 2,
  };
}

function edgePath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = Math.max(48, Math.abs(b.x - a.x) * 0.45);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

function chatReply(prompt: string, nodeIds: string[]): string {
  const q = prompt.toLowerCase();
  if (q.includes("illegal")) {
    return "Illegal example: LoomGuard.avoidance_vector → HeadingCell.steering_command.\nTyped ports reject that — avoidance_vector is not a HeadingCell input. Use Arbiter.override instead.";
  }
  if (q.includes("priority") || q.includes("arbiter") || q.includes("override")) {
    return "BioPilot arbiter:\n1) LoomGuard.trigger → emergency_avoidance (p100)\n2) TargetTrack.visible → HeadingCell.steer (p50)\n3) else → maintain_heading (p10)\nSafety never shares priority with nominal control.";
  }
  if (q.includes("loom")) {
    return "Wire LoomGuard.avoidance_vector → Arbiter.override (hard override).\nDo not splice LoomGuard into HeadingCell — that breaks typed ports and the safety contract.";
  }
  if (q.includes("flow")) {
    return nodeIds.includes("FlowSense")
      ? "FlowSense is on the canvas. Legal wire: FlowSense.optic_flow → HeadingCell.optic_flow."
      : "Click + Flow in the top bar to place FlowSense, then wire optic_flow → HeadingCell.optic_flow.";
  }
  if (q.includes("sim")) {
    return "Open Sim Lab and run Saw blade e-stop or Urban emergency brake — both show LoomGuard hard-freeze on trigger, then Inspect WHY.";
  }
  if (q.includes("wire") || q.includes("connect")) {
    return "Use typed wires only. Open Add → Wires for a legal link, or Illegal wire to see SVM-COMP-001 rejection.";
  }
  return "I can help wire NeuroBlocks, explain arbiter priorities, or catch illegal ports. Try a suggestion chip, or ask about LoomGuard / FlowSense / HeadingCell.";
}

function IconFolder() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function IconSave() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
function IconPlay() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}
function IconReset() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
function IconPlus() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function IconChevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
function IconSend() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

export function ComposeStudio() {
  const [compiled, setCompiled] = useState<SourcePackage | null>(null);
  const [packageHash, setPackageHash] = useState("");
  const [compileBusy, setCompileBusy] = useState(false);
  const [cameraHz, setCameraHz] = useState(200);
  const [deadlineMs, setDeadlineMs] = useState(10);
  const importRef = useRef<HTMLInputElement>(null);
  const [nodes, setNodes] = useState<CanvasNode[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<Edge[]>(DEFAULT_EDGES);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState("LoomGuard");
  const [loomTrigger, setLoomTrigger] = useState(false);
  const [trackVisible, setTrackVisible] = useState(true);
  const [avoidX, setAvoidX] = useState(-0.82);
  const [headingSteer, setHeadingSteer] = useState(0.35);
  const [rightOpen, setRightOpen] = useState(true);
  const [stackName, setStackName] = useState("BioPilot@1.0.0");
  const [savedFlash, setSavedFlash] = useState(false);
  const [menuOpen, setMenuOpen] = useState<null | "add" | "file">(null);
  const [pan, setPan] = useState({ x: 170, y: 100 });
  const [zoom, setZoom] = useState(0.65);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const dragRef = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const panState = useRef(pan);
  const zoomState = useRef(zoom);
  const stageRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panState.current = pan;
  }, [pan]);
  useEffect(() => {
    zoomState.current = zoom;
  }, [zoom]);

  const decision = useMemo(
    () =>
      biopilotArbiter({
        loomTrigger,
        avoidX,
        trackVisible,
        headingSteer,
      }),
    [loomTrigger, trackVisible, avoidX, headingSteer],
  );

  const selectedPorts = PORTS[selected];
  const graph = useMemo<StackGraph>(() => {
    const [name, version] = stackName.split("@");
    return { name, version: version ?? "1.0.0", deadlineMs,
      nodes: nodes.map(n => ({ id:n.id, type:n.id, ...(NODE_DEFS[n.id]?.family === "sensor" ? {params:{hz:cameraHz}} : {}) })),
      edges: edges.map(e => ({from:e.from,to:e.to,mode:"LATEST" as const})) };
  }, [nodes,edges,stackName,cameraHz,deadlineMs]);
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const validation = useMemo(() => validateGraph(graph), [graph]);
  useEffect(() => { setCompiled(null); setPackageHash(""); }, [graph]);
  const download = (name: string, raw: string) => {
    const url = URL.createObjectURL(new Blob([raw], {type:"application/json"}));
    const a = document.createElement("a"); a.href=url; a.download=name; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const compile = async () => {
    setCompileBusy(true); setError(null);
    try {
      const pkg = await compileStack(graph, async slug => {
        const res = await fetch("/blocks/" + slug + "/1.0.0/block.json");
        if (!res.ok) throw new Error("Module unavailable: " + slug);
        return res.text();
      });
      const hash=await digest(canonical(pkg));
      if(graphRef.current !== graph) return;
      setCompiled(pkg); setPackageHash(hash);
    } catch(e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setCompileBusy(false); }
  };
  const applyGraph = (g: StackGraph) => {
    const checked=validateGraph(g); if(checked.errors.length) throw new Error(checked.errors.map(e=>e.message).join("\n"));
    if(g.nodes.some(n=>n.id!==n.type)) throw new Error("This canvas currently supports one instance per node type");
    const sensorRates=g.nodes.filter(n=>NODE_DEFS[n.type]?.family==="sensor").map(n=>n.params?.hz??200);
    if(new Set(sensorRates).size>1) throw new Error("This canvas currently requires a common sensor rate");
    setNodes(g.nodes.map(n=>INITIAL_NODES.find(x=>x.id===n.id)!));
    setEdges(g.edges.map(e=>({...e,kind:e.to.endsWith(".override")?"override":"data"})));
    setStackName(g.name+"@"+g.version); setCameraHz(sensorRates[0]??200);setDeadlineMs(g.deadlineMs);
  };
  const loadSaved = () => {
    try { const raw=localStorage.getItem("synapsevm.workbench.v1");if(!raw) throw new Error("No saved Stack in this browser");applyGraph(JSON.parse(raw));setError(null); }
    catch(e){setError(e instanceof Error?e.message:String(e));}
  };
  const importFile = async (file?: File) => {
    if(!file)return;
    try {if(file.size>20_000_000)throw new Error("Package exceeds 20 MB");const pkg=await importPackage(await file.text());applyGraph(pkg.graph);setError(null);}
    catch(e){setError(e instanceof Error?e.message:String(e));}
  };

  const priorityRows = [
    { if: "LoomGuard.trigger", out: "emergency_avoidance", p: 100, active: loomTrigger },
    { if: "TargetTrack.visible", out: "HeadingCell.steer", p: 50, active: !loomTrigger && trackVisible },
    { if: "else", out: "maintain_heading", p: 10, active: !loomTrigger && !trackVisible },
  ];

  const wireGeometry = useMemo(() => {
    return edges.map((e) => {
      const fromBlock = e.from.split(".")[0];
      const toBlock = e.to.split(".")[0];
      const a = portAnchor(nodes, fromBlock, "out");
      const b = portAnchor(nodes, toBlock, "in");
      return { ...e, d: edgePath(a, b) };
    });
  }, [edges, nodes]);

  const focusNode = useCallback(
    (id: string) => {
      setSelected(id);
      const n = nodes.find((x) => x.id === id);
      if (!n || !stageRef.current) return;
      const rect = stageRef.current.getBoundingClientRect();
      const z = zoomState.current;
      setPan({
        x: rect.width / 2 - (n.x + n.w / 2) * z,
        y: rect.height / 2 - (n.y + n.h / 2) * z,
      });
    },
    [nodes],
  );

  const addBlock = useCallback(
    (id: string) => {
      const meta = PALETTE.find((p) => p.id === id);
      if (!meta) return;
      setMenuOpen(null);
      setNodes((prev) => {
        const existing = prev.find((n) => n.id === id);
        if (existing) {
          queueMicrotask(() => focusNode(id));
          return prev;
        }
        const offset = prev.length * 28;
        const next: CanvasNode = {
          id,
          label: id,
          blurb: meta.blurb,
          tone: meta.tone,
          x: 120 + offset,
          y: 140 + offset,
          w: id === "Arbiter" || id === "HeadingCell" ? 176 : 168,
          h: id === "Arbiter" || id === "HeadingCell" ? 96 : 88,
        };
        queueMicrotask(() => {
          setSelected(id);
        });
        return [...prev, next];
      });
    },
    [focusNode],
  );

  const onNodePointerDown = (id: string, ev: ReactPointerEvent) => {
    ev.stopPropagation();
    ev.currentTarget.setPointerCapture(ev.pointerId);
    const n = nodes.find((x) => x.id === id);
    if (!n) return;
    const z = zoomState.current;
    const p = panState.current;
    dragRef.current = {
      id,
      ox: (ev.clientX - p.x) / z - n.x,
      oy: (ev.clientY - p.y) / z - n.y,
    };
    setSelected(id);
  };

  const onNodePointerMove = (ev: ReactPointerEvent) => {
    if (!dragRef.current) return;
    const { id, ox, oy } = dragRef.current;
    const z = zoomState.current;
    const p = panState.current;
    const nx = (ev.clientX - p.x) / z - ox;
    const ny = (ev.clientY - p.y) / z - oy;
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x: nx, y: ny } : n)));
  };

  const onNodePointerUp = (ev: ReactPointerEvent) => {
    dragRef.current = null;
    try {
      ev.currentTarget.releasePointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onStagePointerDown = (ev: ReactPointerEvent) => {
    if (dragRef.current) return;
    const t = ev.target as HTMLElement;
    if (t.closest(".compose-flow-node")) return;
    panRef.current = { x: pan.x, y: pan.y, px: ev.clientX, py: ev.clientY };
    ev.currentTarget.setPointerCapture(ev.pointerId);
  };

  const onStagePointerMove = (ev: ReactPointerEvent) => {
    if (!panRef.current) return;
    setPan({
      x: panRef.current.x + (ev.clientX - panRef.current.px),
      y: panRef.current.y + (ev.clientY - panRef.current.py),
    });
  };

  const onStagePointerUp = (ev: ReactPointerEvent) => {
    panRef.current = null;
    try {
      ev.currentTarget.releasePointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onNativeWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;
      const prev = zoomState.current;
      const factor = ev.deltaY > 0 ? 0.9 : 1.1;
      const next = Math.min(2.5, Math.max(0.35, prev * factor));
      if (next === prev) return;
      const worldX = (mx - panState.current.x) / prev;
      const worldY = (my - panState.current.y) / prev;
      setZoom(next);
      setPan({
        x: mx - worldX * next,
        y: my - worldY * next,
      });
    };
    el.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => el.removeEventListener("wheel", onNativeWheel);
  }, []);

  const addLegal = (idx = 0) => {
    try {
      const w = LEGAL_WIRES[idx % LEGAL_WIRES.length];
      const e = wire(w.from[0], w.from[1], w.to[0], w.to[1]);
      setEdges((prev) =>
        prev.some((x) => x.from === e.from && x.to === e.to) ? prev : [...prev, { ...e, kind: "data" }],
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const addIllegal = () => {
    try {
      wire("LoomGuard", "avoidance_vector", "HeadingCell", "steering_command");
      setError(null);
    } catch (err) {
      setError(err instanceof ComposeError || err instanceof Error ? err.message : String(err));
    }
  };

  const resetStack = () => {
    setNodes(INITIAL_NODES);
    setEdges(DEFAULT_EDGES);
    setError(null);
    setLoomTrigger(false);
    setTrackVisible(true);
    setPan({ x: 170, y: 100 });
    setZoom(0.65);
  };

  const saveStack = () => {
    try { localStorage.setItem("synapsevm.workbench.v1", JSON.stringify(graph)); setError(null); }
    catch(e) {setError("Could not save Stack: " + String(e)); return;}
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  };

  const submitChat = async (raw?: string) => {
    const text = (raw ?? chatInput).trim();
    if (!text || chatBusy) return;
    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setChatInput("");
    setChatBusy(true);
    await new Promise((r) => setTimeout(r, 450));
    const reply = chatReply(text, nodes.map((n) => n.id));
    if (text.toLowerCase().includes("add flowsense")) addBlock("FlowSense");
    setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: reply }]);
    setChatBusy(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setError(null);
        setMenuOpen(null);
      }
    };
    const onDoc = (e: MouseEvent) => {
      if (!menuBarRef.current?.contains(e.target as Node)) setMenuOpen(null);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
    };
  }, []);

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, chatBusy]);

  const onChatSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submitChat();
  };

  return (
    <div className="compose-studio">
      <div className="compose-main">
        <section className="compose-stage-wrap">
          {/* Siphon-style mid top bar (light) */}
          <div className="compose-top-bar compose-top-bar--visible" role="toolbar" aria-label="Compose actions">
            <div className="compose-toolbar-end" ref={menuBarRef}>
              <div className="compose-file-group">
                <input
                  type="text"
                  className="compose-file-name"
                  value={stackName}
                  onChange={(e) => setStackName(e.target.value)}
                  spellCheck={false}
                  aria-label="Stack name"
                />
              </div>

              <span className="compose-tb-sep" aria-hidden />

              <div className="compose-menu-anchor">
                <button
                  type="button"
                  className={`compose-tb-btn compose-tb-btn--menu ${menuOpen === "add" ? "is-active" : ""}`}
                  onClick={() => setMenuOpen((m) => (m === "add" ? null : "add"))}
                  aria-expanded={menuOpen === "add"}
                  aria-haspopup="menu"
                >
                  <IconPlus />
                  <span>Add</span>
                  <IconChevron />
                </button>
                {menuOpen === "add" && (
                  <div className="compose-add-menu" role="menu" aria-label="Add to canvas">
                    <div className="compose-add-menu-head">NeuroBlocks</div>
                    {PALETTE.map((p) => {
                      const on = nodes.some((n) => n.id === p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          role="menuitem"
                          className={`compose-add-menu-item ${on ? "is-on" : ""}`}
                          onClick={() => {
                            addBlock(p.id);
                            setMenuOpen(null);
                          }}
                        >
                          <span className={`compose-add-dot tone-${p.tone}`} />
                          <span className="compose-add-menu-label">{p.id}</span>
                          {on ? <span className="compose-add-menu-meta">on canvas</span> : null}
                        </button>
                      );
                    })}
                    <div className="compose-add-menu-head">Wires</div>
                    <button
                      type="button"
                      role="menuitem"
                      className="compose-add-menu-item"
                      onClick={() => {
                        addLegal(0);
                        setMenuOpen(null);
                      }}
                    >
                      <span className="compose-add-dot tone-nominal" />
                      <span className="compose-add-menu-label">Legal wire</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="compose-add-menu-item"
                      onClick={() => {
                        addIllegal();
                        setMenuOpen(null);
                      }}
                    >
                      <span className="compose-add-dot tone-safety" />
                      <span className="compose-add-menu-label">Illegal wire</span>
                      <span className="compose-add-menu-meta">demo</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="compose-menu-anchor">
                <button
                  type="button"
                  className={`compose-tb-btn compose-tb-btn--menu ${menuOpen === "file" ? "is-active" : ""}`}
                  onClick={() => setMenuOpen((m) => (m === "file" ? null : "file"))}
                  aria-expanded={menuOpen === "file"}
                  aria-haspopup="menu"
                >
                  <IconFolder />
                  <span>File</span>
                  <IconChevron />
                </button>
                {menuOpen === "file" && (
                  <div className="compose-add-menu compose-add-menu--end" role="menu" aria-label="File actions">
                    <div className="compose-add-menu-head">Stack</div>
                    <button
                      type="button"
                      role="menuitem"
                      className="compose-add-menu-item"
                      onClick={() => {
                        loadSaved();
                        setMenuOpen(null);
                      }}
                    >
                      <IconFolder />
                      <span className="compose-add-menu-label">Load saved</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={`compose-add-menu-item ${savedFlash ? "is-on" : ""}`}
                      onClick={() => {
                        saveStack();
                        setMenuOpen(null);
                      }}
                      disabled={savedFlash}
                    >
                      <IconSave />
                      <span className="compose-add-menu-label">{savedFlash ? "Saved" : "Save"}</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="compose-add-menu-item"
                      onClick={() => {
                        importRef.current?.click();
                        setMenuOpen(null);
                      }}
                    >
                      <span className="compose-add-menu-label">Import…</span>
                    </button>
                    <div className="compose-add-menu-divider" />
                    <button
                      type="button"
                      role="menuitem"
                      className="compose-add-menu-item compose-add-menu-item--danger"
                      onClick={() => {
                        resetStack();
                        setMenuOpen(null);
                      }}
                    >
                      <IconReset />
                      <span className="compose-add-menu-label">Reset canvas</span>
                    </button>
                  </div>
                )}
              </div>

              <input
                ref={importRef}
                type="file"
                accept=".synapse,.json"
                hidden
                onChange={(e) => {
                  void importFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />

              <span className="compose-tb-sep" aria-hidden />

              <button
                type="button"
                className="compose-tb-btn compose-tb-btn--run"
                onClick={compile}
                disabled={compileBusy}
              >
                {compileBusy ? "Compiling…" : "Compile"}
              </button>

              <Link href="/simulate" className="compose-tb-btn" title="Test in Simulate">
                <IconPlay />
                <span>Simulate</span>
              </Link>

              <button type="button" className="compose-tb-btn" onClick={() => setRightOpen(true)} title="Inspector">
                Inspect
              </button>
            </div>
          </div>

          <div
            ref={stageRef}
            className="compose-stage"
            onPointerDown={onStagePointerDown}
            onPointerMove={onStagePointerMove}
            onPointerUp={onStagePointerUp}
          >
            <div className="compose-stage-bg" />
            <div
              className="compose-stage-world"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            >
              <svg className="compose-stage-wires" width="1400" height="900">
                {wireGeometry.map((w) => (
                  <path
                    key={`${w.from}->${w.to}`}
                    d={w.d}
                    className={w.kind === "override" ? "wire-override" : "wire-data"}
                    fill="none"
                  />
                ))}
              </svg>

              {nodes.map((n) => (
                <div
                  key={n.id}
                  className={`compose-flow-node tone-${n.tone} ${selected === n.id ? "active" : ""} ${
                    n.id === "LoomGuard" && loomTrigger ? "firing" : ""
                  }`}
                  style={
                    {
                      left: n.x,
                      top: n.y,
                      width: n.w,
                      minHeight: n.h,
                      // Wire anchors are computed at n.h / 2, so the handles are
                      // pinned to that offset rather than to the rendered height.
                      "--node-h": `${n.h}px`,
                    } as CSSProperties
                  }
                  role="button" tabIndex={0} aria-label={n.label + " · inspect node"}
                  onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelected(n.id);setRightOpen(true);}}}
                  onPointerDown={(e) => onNodePointerDown(n.id, e)}
                  onPointerMove={onNodePointerMove}
                  onPointerUp={onNodePointerUp}
                >
                  <div className="compose-flow-handle in" />
                  <div className="compose-flow-kicker">
                    {NODE_DEFS[n.id]?.family.toUpperCase() ?? "BLOCK"}
                  </div>
                  <div className="compose-flow-title">{n.label}</div>
                  <div className="compose-flow-blurb">{NODE_DEFS[n.id]?.family === "sensor" ? cameraHz + " Hz · " + Object.values(NODE_DEFS[n.id].outputs)[0] : n.blurb}</div>
                  {n.id === "Arbiter" ? (
                    <div className="compose-flow-out mono">
                      {decision.action} · p{decision.priority}
                    </div>
                  ) : PORTS[n.id] ? (
                    <div className="compose-flow-out mono">out · {PORTS[n.id].outputs.join(", ")}</div>
                  ) : null}
                  <div className="compose-flow-handle out" />
                </div>
              ))}
            </div>

            <div className="compose-stage-hint mono">
              scroll to zoom · drag canvas · {Math.round(zoom * 100)}%
            </div>
          </div>

          {error && (
            <div className="compose-toast-error">
              <pre className="mono">{error}</pre>
              <button type="button" className="sim-action" onClick={() => setError(null)}>
                Dismiss
              </button>
            </div>
          )}
        </section>

        {/* Bottom LLM chat — siphon-style dock */}
        <div className={`compose-chat ${messages.length || chatBusy ? "has-thread" : ""}`}>
          {(messages.length > 0 || chatBusy) && (
            <div className="compose-chat-thread-wrap">
              <div ref={threadRef} className="compose-chat-thread" role="log" aria-live="polite">
                {messages.map((msg) => (
                  <div key={msg.id} className={`compose-chat-msg compose-chat-msg--${msg.role}`}>
                    <span className="compose-chat-msg-label">{msg.role === "user" ? "You" : "Composer"}</span>
                    <p className="compose-chat-msg-text">{msg.content}</p>
                  </div>
                ))}
                {chatBusy && (
                  <div className="compose-chat-msg compose-chat-msg--assistant">
                    <span className="compose-chat-msg-label">Composer</span>
                    <p className="compose-chat-msg-text">Thinking…</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="compose-chat-dock">
            <div className="compose-chat-marquee" role="region" aria-label="Suggested prompts">
              <div className="compose-chat-marquee-track">
                {[0, 1].map((copy) => (
                  <div key={copy} className="compose-chat-marquee-strip" aria-hidden={copy === 1}>
                    {CHAT_SUGGESTIONS.map((item, i) => (
                      <Fragment key={`${copy}-${item.label}`}>
                        {i > 0 ? <span className="compose-chat-dot">·</span> : null}
                        <button
                          type="button"
                          className="compose-chat-chip"
                          disabled={chatBusy}
                          tabIndex={copy === 1 ? -1 : 0}
                          onClick={() => setChatInput(item.text)}
                        >
                          {item.label}
                        </button>
                      </Fragment>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <form className="compose-chat-row" onSubmit={onChatSubmit}>
              <div className="compose-chat-composer">
                <input
                  type="text"
                  className="compose-chat-input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about wiring, priorities, or describe a NeuroStack…"
                  disabled={chatBusy}
                  aria-label="Compose chat"
                />
                <button
                  type="submit"
                  className="compose-chat-send"
                  disabled={!chatInput.trim() || chatBusy}
                  title="Send"
                  aria-label="Send"
                >
                  <IconSend />
                </button>
              </div>
            </form>
            <p className="compose-chat-disclaimer">Local wiring guide · scripted suggestions. Compile to check your graph.</p>
          </div>
        </div>
      </div>

      {!rightOpen && (
        <button type="button" className="compose-rail-tab right" onClick={() => setRightOpen(true)}>
          Inspect
        </button>
      )}

      <aside className={`compose-rail compose-rail-right ${rightOpen ? "open" : "closed"}`}>
        <div className="compose-rail-head">
          <div>
            <div className="why-kicker">Inspector</div>
            <div className="compose-rail-title">{selected}</div>
          </div>
          <button type="button" className="compose-icon-btn" onClick={() => setRightOpen(false)} aria-label="Collapse">
            ›
          </button>
        </div>

        <section className="compose-inspect-card protocol-panel" aria-label="Stack compilation">
          <div className="why-kicker">Build & export</div>
          <p className={validation.errors.length ? "protocol-warning" : "protocol-success"}>{validation.errors.length ? validation.errors.length + " validation issues" : "Graph valid · " + graph.nodes.length + " nodes"}</p>
          <label>Sensor rate (Hz)<input type="number" min="1" max="1000" value={cameraHz} onChange={e=>setCameraHz(Number(e.target.value))}/></label>
          <label>Deadline (ms)<input type="number" min="1" value={deadlineMs} onChange={e=>setDeadlineMs(Number(e.target.value))}/></label>
          <p>Estimated critical path: {validation.estimatedCriticalPathMs.toFixed(1)} ms. Not measured on hardware.</p>
          {validation.errors.map((e,i)=><p className="protocol-warning" key={i}>{e.code}: {e.message}</p>)}
          {compiled && <div aria-live="polite">
            <p className="protocol-success">{Object.keys(compiled.lockfile).length} modules locked · source package ready</p>
            <small>Stack identity</small><p className="mono protocol-hash">{compiled.manifest.stackId}</p>
            <small>Exact package digest</small><p className="mono protocol-hash">{packageHash}</p>
            <button className="btn" onClick={()=>download(compiled.manifest.name+"-"+compiled.manifest.version+".synapse",canonical(compiled))}>Export .synapse</button>
            <button className="btn btn-ghost" onClick={async()=>{try{download("simulator.deployment.json",canonical(await deploymentBundle(compiled,cameraHz)));}catch(e){setError(String(e));}}}>Export deployment config</button>
          </div>}
          <p className="muted">Portable source and model data. Composed execution, native bindings, signing, and hardware calibration are not implemented.</p>
        </section>
        <section className="compose-inspect-card trust-lane">
          <div className="why-kicker">Trust lane · after execution</div>
          <p>Receipt → Local replay → External validation → Anchor</p>
          <Link href="/verify">Inspect verification availability →</Link>
        </section>
        <section className="compose-inspect-card">
          <div className="why-kicker">Live arbiter</div>
          <label className="compose-toggle">
            <input type="checkbox" checked={loomTrigger} onChange={(e) => setLoomTrigger(e.target.checked)} />
            <span>
              LoomGuard.trigger <strong>{loomTrigger ? "TRUE" : "false"}</strong>
            </span>
          </label>
          <label className="compose-toggle">
            <input type="checkbox" checked={trackVisible} onChange={(e) => setTrackVisible(e.target.checked)} />
            <span>
              TargetTrack.visible <strong>{trackVisible ? "TRUE" : "false"}</strong>
            </span>
          </label>
          <label className="compose-slider">
            <span className="mono">avoidX {avoidX.toFixed(2)}</span>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.01}
              value={avoidX}
              onChange={(e) => setAvoidX(Number(e.target.value))}
              disabled={!loomTrigger}
            />
          </label>
          <label className="compose-slider">
            <span className="mono">headingSteer {headingSteer.toFixed(2)}</span>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.01}
              value={headingSteer}
              onChange={(e) => setHeadingSteer(Number(e.target.value))}
              disabled={loomTrigger}
            />
          </label>
          <div className={`arbiter-out ${decision.action}`}>
            <div className="why-kicker" style={{ color: "inherit", opacity: 0.7 }}>
              Actuator
            </div>
            <div className="arbiter-action">{decision.action}</div>
            <div className="mono" style={{ fontSize: 12, marginTop: 6 }}>
              priority {decision.priority} · steer {decision.steer.toFixed(3)}
            </div>
          </div>
        </section>

        <section className="compose-inspect-card">
          <div className="why-kicker">Priority rules</div>
          <div className="priority-table">
            {priorityRows.map((r) => (
              <div key={r.if} className={`priority-row ${r.active ? "active" : ""}`}>
                <span className="mono">if {r.if}</span>
                <span className="mono">→ {r.out}</span>
                <span className="mono">p{r.p}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="compose-inspect-card">
          <div className="why-kicker">Ports · {selected}</div>
          {selected === "Arbiter" ? (
            <div className="port-lists">
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  Inputs
                </div>
                <div className="port-chip in">nominal</div>
                <div className="port-chip in">override</div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  Outputs
                </div>
                <div className="port-chip out">actuator_command</div>
              </div>
            </div>
          ) : selectedPorts ? (
            <div className="port-lists">
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  Inputs
                </div>
                {selectedPorts.inputs.map((p) => (
                  <div key={p} className="port-chip in">
                    {p}
                  </div>
                ))}
                {!selectedPorts.inputs.length && <span className="muted">—</span>}
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                  Outputs
                </div>
                {selectedPorts.outputs.map((p) => (
                  <div key={p} className="port-chip out">
                    {p}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Select a block.
            </p>
          )}
        </section>

        <section className="compose-inspect-card">
          <div className="why-kicker">Wires</div>
          <div className="wire-list" style={{ marginTop: 8 }}>
            {edges.map((e) => (
              <div key={`${e.from}->${e.to}`} className={`wire-row ${e.kind === "override" ? "override" : ""}`}>
                <span className="mono">{e.from.split(".")[0]}</span>
                <span aria-hidden>→</span>
                <span className="mono">{e.to.split(".")[0]}</span>
                <span className="wire-kind">{e.kind === "override" ? "OVERRIDE" : "TYPED"}</span>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
