use std::path::PathBuf;

use synapsevm_core::{replay_evidence_bundle, run_loomguard_scenario};

#[test]
fn loomguard_e2e_local_steps_1_to_5() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap();
    let block = root.join("blocks/loomguard/1.0.0/block.json");
    assert!(block.exists(), "LoomGuard block missing — run compiler first");
    let bundles = root.join("receipt-bundles");
    let (receipt, bundle, no_collision) =
        run_loomguard_scenario(&block, 42, 40, 200, &bundles);
    assert!(no_collision, "simulator collided");
    assert!(
        receipt.action_type.starts_with("AVOID_"),
        "expected AVOID_* got {}",
        receipt.action_type
    );
    assert!(bundle.join("receipt.json").exists());
    assert!(bundle.join("input.bin").exists());
    assert!(bundle.join("state-before.bin").exists());

    let replay = replay_evidence_bundle(&bundle, &block);
    assert!(replay.valid, "{replay:?}");
    assert!(replay.state_before_match);
    assert!(replay.state_after_match);
    assert!(replay.trace_root_match);
    assert!(replay.action_match);
}
