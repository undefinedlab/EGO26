/**
 * Spec → ComposeGraph.
 *
 * The synthesiser is deliberately deterministic. A model's job is to fill in
 * a BuildSpec from what the user said; turning that spec into wiring is a
 * typed problem, and letting a model guess at it would only invent illegal
 * ports. Everything here goes through `checkGraph` — the same compiler that
 * guards manual editing — before it is allowed near the canvas.
 *
 * This targets `composeCompiler`, which is what the Compose studio actually
 * runs. That matters: it has two sources of EventVision/v1, two control
 * shapes, three actuators and optional adapters, so the graph genuinely
 * depends on what the user asked for.
 *
 * It also has blocks whose declared interface the bundled model does not
 * implement (FlowSense, HeadingCell, TargetTrack). Those are reported as
 * `blocked`, not as errors: a Stack containing them compiles but comes out
 * `executable: false`. The planner refuses to synthesise them and says why,
 * rather than handing over a graph that can never run.
 */

import { DEFINITIONS, checkGraph, type ComposeGraph, type Issue } from "../composeCompiler";
import {
  BLOCKED_CAPABILITIES,
  CAPABILITY_BLOCKS,
  CAPABILITY_LABELS,
  PLATFORM_ACTUATOR,
  PLATFORM_LABELS,
  type BuildSpec,
  type Capability,
} from "./spec";

export type PlanStep = {
  text: string;
  because: string;
  /** True when the user asked for this node; false when the compiler required it. */
  asked: boolean;
};

export type Plan = {
  graph: ComposeGraph;
  steps: PlanStep[];
  /** Blocking problems found by the real compiler, not by the planner. */
  errors: Issue[];
  /** Non-blocking notes from the compiler. */
  warnings: Issue[];
  /** ABI problems: compiles, but cannot execute. */
  blocked: Issue[];
  /** Things worth saying out loud that are not compiler output. */
  cautions: string[];
  /** Capabilities that were asked for but cannot be built. */
  refused: Capability[];
  /** Whether the resulting package would actually run. */
  executable: boolean;
  /** The compiler's own figure, not an estimate of ours. */
  criticalPathMs: number;
};

export function plan(spec: BuildSpec): Plan {
  const steps: PlanStep[] = [];
  const cautions: string[] = [];
  const nodes: ComposeGraph["nodes"] = [];
  const edges: ComposeGraph["edges"] = [];

  const add = (id: string, type = id, params?: Record<string, number>, because = "", asked = false) => {
    if (!nodes.some((n) => n.id === id)) nodes.push({ id, type, ...(params ? { params } : {}) });
    if (because) steps.push({ text: `Add ${id}`, because, asked });
  };
  const wire = (from: string, to: string) => {
    if (!edges.some((e) => e.from === from && e.to === to)) edges.push({ from, to, mode: "LATEST" });
  };

  const caps = new Set(spec.capabilities);

  // Capabilities whose blocks are ABI-blocked cannot be honoured at all.
  const refused = BLOCKED_CAPABILITIES.filter((c) => caps.has(c));
  for (const c of refused) caps.delete(c);
  if (refused.length) {
    cautions.push(
      `${refused.map((c) => CAPABILITY_LABELS[c]).join("; ")} — not built. ` +
        `${refused.map((c) => CAPABILITY_BLOCKS[c].block).join(", ")} ${refused.length === 1 ? "declares that interface" : "declare those interfaces"}, but the bundled model ` +
        `exposes the shared reflex decoder instead, so a Stack containing ${refused.length === 1 ? "it" : "them"} compiles and then refuses to run. ` +
        `Left out rather than shipped dead.`,
    );
  }

  // --- Vision source. LoomGuard needs EventVision/v1 at 100 Hz or better. ---
  const useSimulator = spec.sensors.includes("simulator") && !spec.sensors.includes("camera");
  let visionPort: string;
  if (useSimulator) {
    add("WorldState", "WorldState", undefined, "Recorded simulator features to bench-test against", true);
    add(
      "WorldToEvents",
      "WorldToEvents",
      undefined,
      "Encodes proximity and looming into the four neural input channels",
      false,
    );
    wire("WorldState.world", "WorldToEvents.world");
    visionPort = "WorldToEvents.events";
  } else {
    add(
      "EventCamera",
      "EventCamera",
      { hz: 200 },
      "Supplies the four-channel feature ABI at 200 Hz, above the 100 Hz floor LoomGuard requires",
      true,
    );
    visionPort = "EventCamera.events";
  }

  // --- The reflex. Every executable path here runs through it. ---
  add(
    "LoomGuard",
    "LoomGuard",
    undefined,
    caps.has("collision-avoidance")
      ? CAPABILITY_BLOCKS["collision-avoidance"].because
      : "The only executable neuroblock here, and the only source of AvoidanceSignal/v1",
    caps.has("collision-avoidance"),
  );
  wire(visionPort, "LoomGuard.event_vision");

  // --- Control shape: keep nominal steering, or gate it entirely. ---
  const keepsNominal = caps.has("nominal-steering");
  let commandPort: string;
  if (keepsNominal) {
    add(
      "SteeringInput",
      "SteeringInput",
      undefined,
      "Conventional nominal steering, so the reflex only overrides on danger",
      true,
    );
    add("Arbiter", "Arbiter", undefined, CAPABILITY_BLOCKS["nominal-steering"].because, true);
    wire("SteeringInput.steering", "Arbiter.nominal");
    wire("LoomGuard.avoidance_vector", "Arbiter.override");
    commandPort = "Arbiter.command";
  } else {
    add(
      "SafetyGate",
      "SafetyGate",
      undefined,
      "Stops forward motion on the neural trigger while preserving the avoidance direction",
      false,
    );
    wire("LoomGuard.avoidance_vector", "SafetyGate.safety");
    commandPort = "SafetyGate.command";
  }

  // --- Optional limiter. ---
  if (caps.has("steering-limit")) {
    add("Clamp", "Clamp", undefined, CAPABILITY_BLOCKS["steering-limit"].because, true);
    wire(commandPort, "Clamp.control");
    commandPort = "Clamp.command";
  }

  // --- Actuator, chosen by platform. ---
  const actuator = spec.platform === "unknown" ? "RoverSteering" : PLATFORM_ACTUATOR[spec.platform];
  if (actuator === "CarBrake") {
    add(
      "BrakeDecoder",
      "BrakeDecoder",
      undefined,
      CAPABILITY_BLOCKS["emergency-brake"].because,
      caps.has("emergency-brake"),
    );
    wire(commandPort, "BrakeDecoder.control");
    add(
      "CarBrake",
      "CarBrake",
      undefined,
      "Brake command for a braked vehicle. Simulated — there is no physical driver.",
      true,
    );
    wire("BrakeDecoder.brake", "CarBrake.brake");
  } else {
    add(
      actuator,
      actuator,
      undefined,
      actuator === "DroneControl"
        ? "Steer, speed and emergency for an aerial platform"
        : "Steer, speed and emergency for a ground platform",
      spec.platform !== "unknown",
    );
    wire(commandPort, `${actuator}.control`);
    if (caps.has("emergency-brake")) {
      cautions.push(
        `A brake command needs CarBrake, which only fits a braked vehicle. On ${PLATFORM_LABELS[spec.platform].toLowerCase()} the emergency flag ` +
          `travels inside the ControlVector to ${actuator} instead.`,
      );
    }
  }

  if (spec.platform === "arm" || spec.platform === "gantry" || spec.platform === "camera") {
    cautions.push(
      `There is no actuator for ${PLATFORM_LABELS[spec.platform].toLowerCase()} in this runtime, so the Stack terminates in RoverSteering. ` +
        `The command shape is steer/speed/emergency — map it yourself at the boundary.`,
    );
  }

  const graph: ComposeGraph = {
    name: spec.name.replace(/[^A-Za-z0-9_-]/g, "").replace(/^[^A-Za-z]+/, "") || "MyStack",
    version: "0.1.0",
    deadlineMs: spec.deadlineMs,
    policy: "AUDIT",
    nodes,
    edges,
  };

  // The real compiler is the authority, not the planner — including on timing.
  let errors: Issue[] = [];
  let warnings: Issue[] = [];
  let blocked: Issue[] = [];
  let criticalPathMs = 0;
  try {
    const result = checkGraph(graph);
    errors = result.errors;
    warnings = result.warnings;
    blocked = result.blocked;
    criticalPathMs = result.estimatedMs;
  } catch (e) {
    errors = [{ code: "GRAPH", message: String(e) }];
  }

  if (criticalPathMs > spec.deadlineMs) {
    cautions.push(
      `Critical path is ${criticalPathMs} ms against a ${spec.deadlineMs} ms deadline. Raise the budget or drop the limiter.`,
    );
  }

  return {
    graph,
    steps,
    errors,
    warnings,
    blocked,
    cautions,
    refused,
    executable: blocked.length === 0 && errors.length === 0,
    criticalPathMs,
  };
}

/** One-line summary for the assistant to say back. */
export function describe(p: Plan) {
  if (!p.graph.nodes.length) return "Nothing to build yet — tell me what it should do.";
  const blocks = p.graph.nodes.filter((n) => DEFINITIONS[n.type]?.family === "neuroblock").map((n) => n.id);
  const chain = p.graph.nodes.map((n) => n.id).join(" → ");
  const neural = blocks.length ? `${blocks.join(", ")} ${blocks.length === 1 ? "is" : "are"} the neural part. ` : "";
  return `${p.graph.nodes.length} nodes — ${chain}. ${neural}${p.executable ? "It compiles and runs." : "It compiles but will not execute."}`;
}
