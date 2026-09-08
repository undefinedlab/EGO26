"use client";

import { create } from "zustand";
import type { StepView } from "./synapseVm";
import type { BlockId, CaseId } from "./blocks";

export type ChannelSample = { name: string; q16: number; value: number };

export type FrameSnapshot = {
  tick: number;
  distance: number;
  danger: number;
  avoidX: number;
  avoidY: number;
  firedCount: number;
  trigger: boolean;
  traceNeuronIds: number[];
  triggerNeuronIds: number[];
  dangerNeuronIds: number[];
  inputChannels: ChannelSample[];
  actionType: string | null;
};

export type ReceiptEvent = {
  tick: number;
  actionType: string;
  danger: number;
  avoidX: number;
  avoidY: number;
  traceNeuronIds: number[];
  triggerNeuronIds: number[];
  dangerNeuronIds: number[];
  input: number[];
  inputChannels: ChannelSample[];
  firedCount: number;
  distance: number;
  caseId: CaseId;
  blockId: BlockId;
  modelBytes: string;
  stateBeforeBytes: number[];
  stateAfterBytes: number[];
  output: StepView;
  /** One simulation tick before the trigger — for WHY? replay. */
  before: FrameSnapshot | null;
};

export type WhyDetail = {
  receipt: ReceiptEvent;
  replayMatch: "idle" | "MATCH" | "MISMATCH" | "ERROR";
  replayError?: string;
  replayFired: number[];
  replayTrigger: boolean;
};

type LabState = {
  running: boolean;
  blockId: BlockId;
  caseId: CaseId;
  tick: number;
  distance: number;
  speed: number;
  /** Multiplier on the scene's baseline approach speed. 1 = as authored. */
  speedScale: number;
  /** Uniform jitter added to every sensor channel, in input units. */
  noise: number;
  blockEnabled: boolean;
  last: StepView | null;
  receipts: ReceiptEvent[];
  whyOpen: boolean;
  whyDetail: WhyDetail | null;
  set: (p: Partial<LabState>) => void;
  pushReceipt: (r: ReceiptEvent) => void;
};

export const useLabStore = create<LabState>((set) => ({
  running: false,
  blockId: "loomguard",
  caseId: "car-brake",
  tick: 0,
  distance: 10,
  speed: 0.055,
  speedScale: 1,
  noise: 0,
  blockEnabled: true,
  last: null,
  receipts: [],
  whyOpen: false,
  whyDetail: null,
  set: (p) => set(p),
  pushReceipt: (r) => set((s) => ({ receipts: [...s.receipts.slice(-19), r] })),
}));
