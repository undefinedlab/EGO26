/**
 * Sensing helpers shared by the lab and by code you write in it.
 *
 * The scenario list that used to live here became the actor list in
 * `actors.ts` — one situation, three bodies, rather than six variations on a
 * road. What survived is the part that is about signals rather than staging.
 */

import type { Inputs } from "./composeRuntime";

/**
 * Sensor channels saturate at full scale.
 *
 * `roadInputs` scales looming by speed against a 28.8 km/h baseline, so any
 * faster approach can push a channel past Q16 full scale and the runtime
 * rightly refuses it. A real sensor clips instead of reporting impossible
 * values, so clipping here is both the honest model and the safe one.
 */
export function saturate(inputs: Inputs): Inputs {
  const out: Inputs = {};
  for (const [id, signal] of Object.entries(inputs)) {
    out[id] = { kind: signal.kind, values: signal.values.map((v) => Math.max(0, Math.min(65536, Math.round(v)))) };
  }
  return out;
}

/**
 * Input conditioning — the one honest lever on when a locked block commits.
 *
 * The reflex fires on its own neural trigger, which lives in the model bytes
 * and is not a parameter of anything. What you can change is what the model is
 * shown: a pre-gain on the vision channels makes the same obstacle read as
 * nearer or further, so the same block commits earlier or later.
 *
 * This is ordinary integration work — sensor scaling in front of a component —
 * not a modification of the block, and the block's digest is untouched by it.
 */
export function condition(inputs: Inputs, gain: number): Inputs {
  if (gain === 1) return inputs;
  const out: Inputs = {};
  for (const [id, signal] of Object.entries(inputs)) {
    out[id] =
      signal.kind === "WorldState/v1" || signal.kind === "EventVision/v1"
        ? { kind: signal.kind, values: signal.values.map((v) => Math.round(v * gain)) }
        : signal;
  }
  return out;
}
