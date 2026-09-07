//! Deterministic fixed-point SynapseVM runtime.

mod block;
mod fixed;
mod lif;
mod receipt;
mod scenario;
mod vm;

pub use block::{load_block_json, load_block_path, BlockJson, InputChannel, NeuroBlock};
pub use fixed::{q16, FixedQ16, ONE};
pub use lif::{LifParams, NeuronState};
pub use receipt::{build_receipt, hash_receipt_chain, sign_receipt_bytes, ReceiptBuilder};
pub use scenario::{
    biopilot_decide, replay_evidence_bundle, run_loomguard_scenario, write_evidence_bundle,
    ActionJson, ArbiterInput, ArbiterOutput, EvidenceMeta, ReplayResult,
};
pub use vm::{
    decode_loomguard, hash_input, init, restore, runtime_hash, snapshot, state_root_of, step,
    HelloBlock, StepResult, TraceMode, VmState,
};

pub const RUNTIME_ID: &str = "synapsevm-core-0.1.0";
pub const RUNTIME_HASH_SEED: &[u8] = b"synapsevm-core-0.1.0-lif-fixed-v1";
