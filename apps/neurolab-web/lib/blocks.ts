export type BlockId = "loomguard" | "flowsense" | "headingcell" | "targettrack";
export type CaseId =
  | "car-brake"
  | "saw-estop"
  | "flow-gust"
  | "flow-gantry"
  | "heading-arm"
  | "heading-spin"
  | "track-part"
  | "track-beacon";

export type NeuroBlockMeta = {
  id: BlockId;
  name: string;
  version: string;
  slug: string;
  tagline: string;
  description: string;
  organism: string;
  priority: string;
  tags: string[];
  likes: number;
  downloads: number;
  neuronCount: number;
  synapseCount: number;
  inputs: string[];
  outputs: string[];
};

export type SimCase = {
  id: CaseId;
  blockId: BlockId;
  title: string;
  tag: string;
  summary: string;
  hazard: string;
  success: string;
  actionOnTrigger: string;
  scene: "street" | "air" | "corridor" | "open" | "mill" | "bench";
  defaultSpeed: number;
};

/** Placeholder use cases shown greyed-out in Sim Lab. */
export type ComingSoonUseCase = {
  id: string;
  blockId: BlockId;
  title: string;
  tag: string;
  summary: string;
  hazard: string;
  success: string;
  actionOnTrigger: string;
};

export const NEURO_BLOCKS: NeuroBlockMeta[] = [
  {
    id: "loomguard",
    name: "LoomGuard",
    version: "1.0.0",
    slug: "synapsevm/LoomGuard",
    tagline: "Looming collision reflex",
    description:
      "Connectome-derived looming/avoidance primitive from FlyWire optic escape circuitry. Hard safety override for machines.",
    organism: "Drosophila melanogaster",
    priority: "safety_reflex",
    tags: ["safety", "looming", "LIF", "Q16.16"],
    likes: 1842,
    downloads: 12040,
    neuronCount: 780,
    synapseCount: 7538,
    inputs: ["event_vision", "depth_proxy"],
    outputs: ["danger", "avoid_x", "avoid_y", "trigger"],
  },
  {
    id: "flowsense",
    name: "FlowSense",
    version: "1.0.0",
    slug: "synapsevm/FlowSense",
    tagline: "Self-motion from optic flow",
    description: "Estimates translational / rotational flow for stable cruise and drift correction.",
    organism: "Drosophila melanogaster",
    priority: "nominal",
    tags: ["optic-flow", "ego-motion", "LIF"],
    likes: 612,
    downloads: 4088,
    neuronCount: 64,
    synapseCount: 63,
    inputs: ["event_vision"],
    outputs: ["flowX", "flowY", "rotation", "confidence"],
  },
  {
    id: "headingcell",
    name: "HeadingCell",
    version: "1.0.0",
    slug: "synapsevm/HeadingCell",
    tagline: "Heading estimate + steer",
    description: "Maintains a heading estimate and emits steer corrections when yaw error grows.",
    organism: "Drosophila melanogaster",
    priority: "nominal",
    tags: ["heading", "steer", "LIF"],
    likes: 498,
    downloads: 3210,
    neuronCount: 48,
    synapseCount: 47,
    inputs: ["yawDelta", "opticFlowRotation", "targetBearing"],
    outputs: ["headingEstimate", "headingError", "steer"],
  },
  {
    id: "targettrack",
    name: "TargetTrack",
    version: "1.0.0",
    slug: "synapsevm/TargetTrack",
    tagline: "Small-target pursuit",
    description: "Locks a sparse visual target and keeps it centered with lateral / vertical pursuit.",
    organism: "Drosophila melanogaster",
    priority: "nominal",
    tags: ["tracking", "pursuit", "LIF"],
    likes: 734,
    downloads: 5512,
    neuronCount: 80,
    synapseCount: 79,
    inputs: ["event_vision"],
    outputs: ["targetX", "targetY", "targetStrength", "visible"],
  },
];

export const SIM_CASES: SimCase[] = [
  {
    id: "car-brake",
    blockId: "loomguard",
    title: "Urban emergency brake",
    tag: "Car",
    summary: "Pedestrian steps into the lane. LoomGuard fires a hard brake — not a dodge.",
    hazard: "Crossing pedestrian",
    success: "Stop before contact",
    actionOnTrigger: "BRAKE",
    scene: "street",
    defaultSpeed: 0.22,
  },
  {
    id: "saw-estop",
    blockId: "loomguard",
    title: "Saw blade e-stop",
    tag: "Mill",
    summary: "Hand enters the danger zone. LoomGuard kills the blade in one reflex tick.",
    hazard: "Intrusion near blade",
    success: "Blade stop before contact",
    actionOnTrigger: "E-STOP",
    scene: "mill",
    defaultSpeed: 0.2,
  },
  {
    id: "flow-gust",
    blockId: "flowsense",
    title: "Crosswind gust",
    tag: "Drone",
    summary: "Lateral gust pushes the craft. FlowSense detects ego-motion and recovers.",
    hazard: "Wind shear",
    success: "Stabilize drift",
    actionOnTrigger: "CORRECT DRIFT",
    scene: "air",
    defaultSpeed: 0.048,
  },
  {
    id: "flow-gantry",
    blockId: "flowsense",
    title: "Gantry centering",
    tag: "Gantry",
    summary: "Optic-flow asymmetry over a press line cues the overhead gantry back to center.",
    hazard: "Rail offset",
    success: "Re-center over die",
    actionOnTrigger: "CENTER",
    scene: "mill",
    defaultSpeed: 0.05,
  },
  {
    id: "heading-arm",
    blockId: "headingcell",
    title: "Arm yaw lock",
    tag: "Robot arm",
    summary: "Joint yaw drifts mid-reach. HeadingCell snaps the wrist back onto the approach axis.",
    hazard: "Wrist yaw error",
    success: "Realign approach",
    actionOnTrigger: "STEER",
    scene: "bench",
    defaultSpeed: 0.045,
  },
  {
    id: "heading-spin",
    blockId: "headingcell",
    title: "Spin recovery",
    tag: "Drone",
    summary: "Sudden yaw spike. HeadingCell clamps rotation and restores bearing.",
    hazard: "Yaw spike",
    success: "Kill spin",
    actionOnTrigger: "YAW LOCK",
    scene: "air",
    defaultSpeed: 0.052,
  },
  {
    id: "track-part",
    blockId: "targettrack",
    title: "Part lock grasp",
    tag: "Robot hand",
    summary: "Moving part on the belt. TargetTrack locks the tip and holds pursuit into grasp.",
    hazard: "Sliding workpiece",
    success: "Acquire + hold",
    actionOnTrigger: "LOCK ON",
    scene: "bench",
    defaultSpeed: 0.05,
  },
  {
    id: "track-beacon",
    blockId: "targettrack",
    title: "Beacon follow",
    tag: "Drone",
    summary: "A sparse beacon drifts in FOV. TargetTrack keeps it locked center.",
    hazard: "Drifting target",
    success: "Hold lock",
    actionOnTrigger: "PURSUE",
    scene: "open",
    defaultSpeed: 0.046,
  },
];

/** Extra use cases shown as locked / greyed-out cards. */
export const COMING_SOON_CASES: ComingSoonUseCase[] = [
  {
    id: "loom-press",
    blockId: "loomguard",
    title: "Press guard interrupt",
    tag: "Press",
    summary: "Operator reaches under a descending ram — hard interrupt before crush.",
    hazard: "Zone intrusion",
    success: "Ram halt",
    actionOnTrigger: "STOP",
  },
  {
    id: "loom-weld",
    blockId: "loomguard",
    title: "Weld flash shy",
    tag: "Welder",
    summary: "Sudden bright flash near the torch tip — retract torch before burn.",
    hazard: "Arc flash",
    success: "Torch retract",
    actionOnTrigger: "RETRACT",
  },
  {
    id: "flow-hover",
    blockId: "flowsense",
    title: "Hover hold",
    tag: "Drone",
    summary: "Null optic flow hold for station-keeping over a pad.",
    hazard: "Drift noise",
    success: "Hold position",
    actionOnTrigger: "HOLD",
  },
  {
    id: "heading-dock",
    blockId: "headingcell",
    title: "Dock align",
    tag: "AGV",
    summary: "Final approach heading lock into a charging bay.",
    hazard: "Bay misalignment",
    success: "Align ±2°",
    actionOnTrigger: "ALIGN",
  },
  {
    id: "track-hand-off",
    blockId: "targettrack",
    title: "Target hand-off",
    tag: "Vision",
    summary: "Pass lock from one target to another without losing frame.",
    hazard: "Occlusion",
    success: "Seamless lock",
    actionOnTrigger: "HANDOFF",
  },
];

export function getBlock(id: BlockId): NeuroBlockMeta {
  return NEURO_BLOCKS.find((b) => b.id === id) ?? NEURO_BLOCKS[0];
}

export function casesForBlock(id: BlockId): SimCase[] {
  return SIM_CASES.filter((c) => c.blockId === id);
}

export function comingSoonForBlock(id: BlockId): ComingSoonUseCase[] {
  return COMING_SOON_CASES.filter((c) => c.blockId === id);
}

export function getCase(id: CaseId): SimCase {
  return SIM_CASES.find((c) => c.id === id) ?? SIM_CASES[0];
}
