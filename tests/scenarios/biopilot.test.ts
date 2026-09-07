import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { biopilotArbiter, ComposeError, wire } from "../../apps/neurolab-web/lib/biopilot.ts";

describe("BioPilot composition", () => {
  it("wires typed ports", () => {
    const edge = wire("FlowSense", "optic_flow", "HeadingCell", "optic_flow");
    assert.equal(edge.from,"FlowSense.optic_flow");
  });

  it("rejects illegal ports", () => {
    assert.throws(() => wire("LoomGuard", "avoidance_vector", "HeadingCell", "steering_command"),
      ComposeError,
    );
  });

  it("hard-overrides on loom trigger", () => {
    const out = biopilotArbiter({
      loomTrigger: true,
      avoidX: 1,
      trackVisible: true,
      headingSteer: 0.2,
    });
    assert.equal(out.action,"emergency_avoidance");
    assert.equal(out.priority,100);
  });
});
