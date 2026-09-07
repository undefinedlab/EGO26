use synapsevm_core::{biopilot_decide, ArbiterInput};

#[test]
fn loom_hard_override_wins() {
    let out = biopilot_decide(ArbiterInput {
        loom_trigger: true,
        avoid_x: 1,
        track_visible: true,
        heading_steer: 2,
    });
    assert_eq!(out.priority, 100);
    assert_eq!(out.action, "emergency_avoidance");
}
