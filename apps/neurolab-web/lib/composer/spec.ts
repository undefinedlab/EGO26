/**
 * The build spec — what the user is trying to make.
 *
 * This is the contract between the conversation and the graph synthesiser.
 * A model (or the local extractor) fills this in; the synthesiser turns it
 * into a ComposeGraph; `checkGraph` validates it. Nothing reaches the canvas
 * that has not been through the real compiler.
 *
 * Everything here is expressed in terms of what `composeCompiler` can
 * actually build, which is why the capability list is shorter than a wish
 * list would be.
 */

export type Platform = "ground-robot" | "drone" | "vehicle" | "arm" | "gantry" | "camera" | "unknown";

/** Where EventVision/v1 comes from. */
export type Sensor = "camera" | "simulator" | "imu";

export type Capability =
  /* Executable today. */
  | "collision-avoidance"
  | "nominal-steering"
  | "emergency-brake"
  | "steering-limit"
  /* Declared in the block interface, but the bundled model does not implement it. */
  | "course-holding"
  | "drift-correction"
  | "target-following";

/** Capabilities the bundled models can actually run. */
export const EXECUTABLE_CAPABILITIES: Capability[] = [
  "collision-avoidance",
  "nominal-steering",
  "emergency-brake",
  "steering-limit",
];

/** Capabilities whose blocks exist but are ABI-blocked, so the Stack cannot run. */
export const BLOCKED_CAPABILITIES: Capability[] = ["course-holding", "drift-correction", "target-following"];

export const PLATFORM_LABELS: Record<Platform, string> = {
  "ground-robot": "Ground robot or rover",
  drone: "Drone or UAV",
  vehicle: "Vehicle with brakes",
  arm: "Robot arm",
  gantry: "Gantry or CNC",
  camera: "Fixed camera",
  unknown: "Unspecified platform",
};

export const CAPABILITY_LABELS: Record<Capability, string> = {
  "collision-avoidance": "Stop or swerve before hitting something",
  "nominal-steering": "Keep normal steering, override only on danger",
  "emergency-brake": "Emit a brake command",
  "steering-limit": "Clamp how hard it can steer",
  "course-holding": "Hold a heading and steer to a goal",
  "drift-correction": "Cancel drift and gusts",
  "target-following": "Track and follow a moving target",
};

/** Which node each capability contributes, and why. */
export const CAPABILITY_BLOCKS: Record<Capability, { block: string; because: string }> = {
  "collision-avoidance": {
    block: "LoomGuard",
    because: "The locked looming model, run with the fixed-point neural runtime",
  },
  "nominal-steering": {
    block: "Arbiter",
    because: "Passes nominal steering through and lets the safety signal win when danger crosses the threshold",
  },
  "emergency-brake": { block: "BrakeDecoder", because: "Maps emergency or zero-speed commands to full brake" },
  "steering-limit": { block: "Clamp", because: "Limits steering magnitude while preserving speed and the emergency flag" },
  "course-holding": { block: "HeadingCell", because: "Declares a SteeringCommand interface the bundled model does not implement" },
  "drift-correction": { block: "FlowSense", because: "Declares an OpticFlow interface the bundled model does not implement" },
  "target-following": { block: "TargetTrack", because: "Declares a TargetBearing interface the bundled model does not implement" },
};

/** Platform decides how the Stack terminates. */
export const PLATFORM_ACTUATOR: Record<Exclude<Platform, "unknown">, string> = {
  "ground-robot": "RoverSteering",
  drone: "DroneControl",
  vehicle: "CarBrake",
  arm: "RoverSteering",
  gantry: "RoverSteering",
  camera: "RoverSteering",
};

export type BuildSpec = {
  platform: Platform;
  sensors: Sensor[];
  capabilities: Capability[];
  /** What the user said, kept verbatim for provenance. */
  notes: string[];
  /** Control loop budget, milliseconds. */
  deadlineMs: number;
  name: string;
};

export const emptySpec = (): BuildSpec => ({
  platform: "unknown",
  sensors: [],
  capabilities: [],
  notes: [],
  deadlineMs: 10,
  name: "MyStack",
});

/** What the spec still needs before a graph can be synthesised. */
export function missing(spec: BuildSpec): { field: keyof BuildSpec; question: string; options?: string[] }[] {
  const gaps: { field: keyof BuildSpec; question: string; options?: string[] }[] = [];

  if (!spec.capabilities.length) {
    gaps.push({
      field: "capabilities",
      question: "What should it do that it cannot do now?",
      options: Object.entries(CAPABILITY_LABELS).map(([k, v]) => `${k}: ${v}`),
    });
  }

  if (spec.platform === "unknown") {
    gaps.push({
      field: "platform",
      question: "What is it running on? This decides which actuator the Stack ends in.",
      options: Object.entries(PLATFORM_LABELS)
        .filter(([k]) => k !== "unknown")
        .map(([k, v]) => `${k}: ${v}`),
    });
  }

  // LoomGuard needs EventVision/v1 and only two things produce it.
  if (!spec.sensors.some((s) => s === "camera" || s === "simulator")) {
    gaps.push({
      field: "sensors",
      question:
        "Where does vision come from? A pre-encoded event camera on the machine, or recorded simulator features for a bench test?",
      options: [
        "camera: event camera supplying the four-channel feature ABI",
        "simulator: recorded WorldState features, encoded by WorldToEvents",
      ],
    });
  }

  return gaps;
}

export const isBuildable = (spec: BuildSpec) => missing(spec).length === 0;
