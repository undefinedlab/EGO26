/** Typed NeuroStack composition + BioPilot arbiter. */

export type PortType =
  | "event_vision"
  | "optic_flow"
  | "heading_delta"
  | "target_bearing"
  | "avoidance_vector"
  | "steering_command";

export class ComposeError extends Error {
  code = "SVM-COMP-001";
  constructor(message: string) {
    super(`ERROR SVM-COMP-001\n${message}`);
  }
}

export type BlockPorts = { inputs: PortType[]; outputs: PortType[] };

export const PORTS: Record<string, BlockPorts> = {
  LoomGuard: { inputs: ["event_vision"], outputs: ["avoidance_vector"] },
  FlowSense: { inputs: ["event_vision"], outputs: ["optic_flow"] },
  HeadingCell: {
    inputs: ["optic_flow", "heading_delta", "target_bearing"],
    outputs: ["steering_command"],
  },
  TargetTrack: { inputs: ["event_vision"], outputs: ["target_bearing"] },
};

export function wire(fromBlock: string, fromPort: PortType, toBlock: string, toPort: PortType) {
  const src = PORTS[fromBlock];
  const dst = PORTS[toBlock];
  if (!src || !dst) throw new ComposeError("unknown block");
  if (!src.outputs.includes(fromPort)) {
    throw new ComposeError(`${fromBlock} does not emit ${fromPort}`);
  }
  if (!dst.inputs.includes(toPort)) {
    throw new ComposeError(`${toBlock} expects input ${toPort}\nReceived ${fromPort}`);
  }
  if (fromPort !== toPort) throw new ComposeError("Port types differ: " + fromPort + " → " + toPort);
  return { from: `${fromBlock}.${fromPort}`, to: `${toBlock}.${toPort}` };
}

export type ArbiterInput = {
  loomTrigger: boolean;
  avoidX: number;
  trackVisible: boolean;
  headingSteer: number;
};

export type ArbiterOutput = {
  action: "emergency_avoidance" | "track_steer" | "maintain_heading";
  priority: number;
  steer: number;
};

export function biopilotArbiter(input: ArbiterInput): ArbiterOutput {
  if (input.loomTrigger) {
    return { action: "emergency_avoidance", priority: 100, steer: input.avoidX };
  }
  if (input.trackVisible) {
    return { action: "track_steer", priority: 50, steer: input.headingSteer };
  }
  return { action: "maintain_heading", priority: 10, steer: 0 };
}
