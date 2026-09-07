use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use crate::{
    build_receipt, hash_input, init, load_block_path, q16, restore, snapshot, step,
    ReceiptBuilder, TraceMode, VmState,
};
use synapsevm_merkle::keccak256;
use synapsevm_types::{Hex32, NeuroReceipt};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceMeta {
    pub block_path: String,
    pub device_id: String,
    pub seed: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionJson {
    pub action_type: String,
    pub danger: i32,
    pub avoid_x: i32,
    pub avoid_y: i32,
    pub trigger: bool,
}

pub fn write_evidence_bundle(
    dir: impl AsRef<Path>,
    receipt: &NeuroReceipt,
    input: &[i32],
    state_before: &[u8],
    trace: &[u8],
    action: &ActionJson,
    block_manifest: &str,
    meta: &EvidenceMeta,
) -> PathBuf {
    let dir = dir.as_ref();
    fs::create_dir_all(dir).expect("mkdir");
    fs::write(dir.join("receipt.json"), serde_json::to_vec_pretty(receipt).unwrap()).unwrap();
    let mut input_bin = Vec::new();
    for v in input {
        input_bin.extend_from_slice(&v.to_le_bytes());
    }
    fs::write(dir.join("input.bin"), input_bin).unwrap();
    fs::write(dir.join("state-before.bin"), state_before).unwrap();
    fs::write(dir.join("trace.bin"), trace).unwrap();
    fs::write(
        dir.join("action.json"),
        serde_json::to_vec_pretty(action).unwrap(),
    )
    .unwrap();
    fs::write(dir.join("block-manifest.json"), block_manifest).unwrap();
    fs::write(dir.join("meta.json"), serde_json::to_vec_pretty(meta).unwrap()).unwrap();
    dir.to_path_buf()
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayResult {
    pub valid: bool,
    pub input_match: bool,
    pub runtime_match: bool,
    pub signature_valid: bool,
    pub receipt_id_match: bool,
    pub block_root_match: bool,
    pub state_before_match: bool,
    pub trace_root_match: bool,
    pub state_after_match: bool,
    pub action_match: bool,
    pub message: String,
}

pub fn replay_evidence_bundle(bundle_dir: impl AsRef<Path>, block_json_path: impl AsRef<Path>) -> ReplayResult {
    let check = || -> Result<ReplayResult, Box<dyn std::error::Error>> {
        let dir = bundle_dir.as_ref();
        let receipt: NeuroReceipt = serde_json::from_slice(&fs::read(dir.join("receipt.json"))?)?;
        if receipt.schema != "synapsevm.neuroreceipt.v2" { return Err("unsupported receipt schema; regenerate v1 demo evidence".into()); }
        if receipt.stack_root != Hex32::default() { return Err("composed Stack replay is not implemented".into()); }
        let input_bytes = fs::read(dir.join("input.bin"))?;
        if input_bytes.len() % 4 != 0 { return Err("invalid input encoding".into()); }
        let state_before = fs::read(dir.join("state-before.bin"))?;
        let action: ActionJson = serde_json::from_slice(&fs::read(dir.join("action.json"))?)?;
        let block = load_block_path(block_json_path.as_ref())?;
        let mut state = init(&block)?; restore(&mut state, &state_before)?;
        let input: Vec<i32> = input_bytes.chunks_exact(4).map(|c| i32::from_le_bytes(c.try_into().unwrap())).collect();
        let result = step(&mut state, &input, receipt.tick, TraceMode::Sparse)?;
        let action_type = if result.loom.trigger { if result.loom.avoid_x >= 0 { "AVOID_LEFT" } else { "AVOID_RIGHT" } } else { "HOLD" };
        let block_root_match = Hex32(block.block_bytes_hash) == receipt.block_root;
        let state_before_match = Hex32(keccak256(&state_before)) == receipt.state_before_root;
        let trace_root_match = result.trace_root == receipt.trace_root;
        let state_after_match = result.state_root == receipt.state_after_root;
        let input_match = hash_input(&input) == receipt.input_root && hash_input(&input) == receipt.encoded_input_root;
        let runtime_match = crate::vm::runtime_hash() == receipt.runtime_hash;
        let action_match = action_type == action.action_type && action_type == receipt.action_type
            && result.loom.trigger == action.trigger && result.loom.danger == action.danger
            && result.loom.avoid_x == action.avoid_x && result.loom.avoid_y == action.avoid_y
            && Hex32(keccak256(&serde_json::to_vec(&action)?)) == receipt.action_data_hash;
        let key_bytes: [u8;32] = fs::read(dir.join("verifying-key.bin"))?.try_into().map_err(|_| "invalid verifying key")?;
        let key = ed25519_dalek::VerifyingKey::from_bytes(&key_bytes)?;
        let signature_valid = receipt.signature_scheme == "ed25519" && crate::receipt::verify_receipt_signature(&key, &crate::receipt::canonical_receipt_message(&receipt), &receipt.signature);
        let mut unsigned = receipt.clone(); unsigned.receipt_id.clear();
        let receipt_id_match = receipt.receipt_id == Hex32(keccak256(&crate::receipt::canonical_receipt_message(&unsigned))).to_hex();
        let valid = block_root_match && state_before_match && trace_root_match && state_after_match && action_match && input_match && runtime_match && signature_valid && receipt_id_match;
        Ok(ReplayResult { valid, input_match, runtime_match, signature_valid, receipt_id_match, block_root_match, state_before_match, trace_root_match, state_after_match, action_match,
            message: if valid { "Replay matches; signature matches bundled key. Publisher/device trust and chain completeness are not established.".into() } else { "NEURORECEIPT REPLAY: MISMATCH".into() } })
    };
    check().unwrap_or_else(|e| ReplayResult { valid:false,input_match:false,runtime_match:false,signature_valid:false,receipt_id_match:false,block_root_match:false,state_before_match:false,trace_root_match:false,state_after_match:false,action_match:false,message:e.to_string() })
}

pub fn run_loomguard_scenario(
    block_path: impl AsRef<Path>,
    seed: u64,
    obstacle_tick: u64,
    max_ticks: u64,
    bundle_root: impl AsRef<Path>,
) -> (NeuroReceipt, PathBuf, bool) {
    let block = load_block_path(block_path.as_ref()).expect("block");
    let mut state = init(&block).expect("init");
    let mut builder = ReceiptBuilder::from_seed("simulator-001", {
        let mut seed_bytes = [0u8; 32];
        seed_bytes[..8].copy_from_slice(&seed.to_le_bytes());
        seed_bytes
    });
    let block_root = Hex32(block.block_bytes_hash);
    let stack_root = Hex32::default();

    let mut collided = false;
    let mut distance = 8.0_f64;
    let speed = 0.02 + ((seed % 5) as f64) * 0.002;
    let mut last_receipt: Option<NeuroReceipt> = None;
    let mut bundle_path = PathBuf::new();
    let mut prev_trigger = false;

    for tick in 0..max_ticks {
        let approaching = tick >= obstacle_tick;
        if approaching {
            distance -= speed;
        }
        if distance <= 0.0 {
            collided = true;
            break;
        }

        let proximity = if approaching {
            ((1.0 / distance.max(0.15)) / 4.0).clamp(0.0, 1.0)
        } else {
            0.0
        };
        let loom = if approaching && distance < 5.0 {
            ((5.0 - distance) / 5.0).clamp(0.0, 1.0)
        } else {
            0.0
        };

        let input = [
            q16(proximity),
            q16(proximity * 0.4),
            q16(proximity * 0.4),
            q16(loom),
        ];

        let before = snapshot(&state);
        let before_root = Hex32(keccak256(&before));
        let result = step(&mut state, &input, tick, TraceMode::Sparse).expect("step");

        if result.loom.trigger {
            // evasive: increase distance slightly (successful avoid)
            distance += 0.35;
            let action_type = if result.loom.avoid_x >= 0 {
                "AVOID_LEFT"
            } else {
                "AVOID_RIGHT"
            };
            if !prev_trigger {
                let action = ActionJson {
                    action_type: action_type.into(),
                    danger: result.loom.danger,
                    avoid_x: result.loom.avoid_x,
                    avoid_y: result.loom.avoid_y,
                    trigger: true,
                };
                let action_bytes = serde_json::to_vec(&action).unwrap();
                let receipt = build_receipt(
                    &mut builder,
                    block_root,
                    stack_root,
                    tick,
                    hash_input(&input),
                    hash_input(&input),
                    before_root,
                    result.trace_root,
                    result.state_root,
                    action_type,
                    &action_bytes,
                    tick.saturating_mul(1000),
                );
                let id = receipt.receipt_id.trim_start_matches("0x");
                let short = &id[..16.min(id.len())];
                let dir = bundle_root.as_ref().join(short);
                let manifest = fs::read_to_string(
                    block_path
                        .as_ref()
                        .parent()
                        .unwrap()
                        .join("manifest.json"),
                )
                .unwrap_or_else(|_| "{}".into());
                let trace_bytes = serde_json::to_vec(&result.trace).unwrap();
                bundle_path = write_evidence_bundle(
                    &dir,
                    &receipt,
                    &input,
                    &before,
                    &trace_bytes,
                    &action,
                    &manifest,
                    &EvidenceMeta {
                        block_path: block_path.as_ref().display().to_string(),
                        device_id: "simulator-001".into(),
                        seed,
                    },
                );
                fs::write(bundle_path.join("verifying-key.bin"), builder.verifying_key_bytes()).expect("write verifying key");
                last_receipt = Some(receipt);
            }
            prev_trigger = true;
        } else {
            prev_trigger = false;
        }
    }

    let receipt = last_receipt.expect("expected avoidance receipt");
    (receipt, bundle_path, !collided)
}

pub fn ensure_vm_state(_s: &VmState) {}

#[derive(Clone, Debug)]
pub struct ArbiterInput {
    pub loom_trigger: bool,
    pub avoid_x: i32,
    pub track_visible: bool,
    pub heading_steer: i32,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ArbiterOutput {
    pub action: &'static str,
    pub priority: u32,
    pub steer: i32,
}

/// BioPilot priority arbiter (LoomGuard hard override).
pub fn biopilot_decide(input: ArbiterInput) -> ArbiterOutput {
    if input.loom_trigger {
        return ArbiterOutput {
            action: "emergency_avoidance",
            priority: 100,
            steer: input.avoid_x,
        };
    }
    if input.track_visible {
        return ArbiterOutput {
            action: "track_steer",
            priority: 50,
            steer: input.heading_steer,
        };
    }
    ArbiterOutput {
        action: "maintain_heading",
        priority: 10,
        steer: 0,
    }
}
