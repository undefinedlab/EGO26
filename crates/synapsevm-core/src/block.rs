use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::fixed::FixedQ16;
use crate::lif::LifParams;

#[derive(Debug, Error)]
pub enum BlockError {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("json: {0}")]
    Json(#[from] serde_json::Error),
    #[error("invalid block: {0}")]
    Invalid(String),
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InputChannel {
    pub name: String,
    pub targets: Vec<u32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputChannels {
    pub danger: Vec<u32>,
    pub avoid_left: Vec<u32>,
    pub avoid_right: Vec<u32>,
    pub avoid_y: Vec<u32>,
    pub trigger: Vec<u32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockJson {
    pub schema: String,
    pub name: String,
    pub version: String,
    pub neuron_count: u32,
    pub csr_offsets: Vec<u32>,
    pub csr_pres: Vec<u32>,
    pub csr_weights: Vec<i32>,
    pub leak: i32,
    pub threshold: i32,
    pub reset: i32,
    pub input_channels: Vec<InputChannel>,
    pub output_channels: OutputChannels,
    pub trigger_threshold: i32,
    #[serde(default)]
    pub flywire_ids: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct NeuroBlock {
    pub name: String,
    pub version: String,
    pub neuron_count: u32,
    pub csr_offsets: Vec<u32>,
    pub csr_pres: Vec<u32>,
    pub csr_weights: Vec<FixedQ16>,
    pub params: LifParams,
    pub input_channels: Vec<InputChannel>,
    pub output_channels: OutputChannels,
    pub trigger_threshold: i32,
    pub flywire_ids: Vec<String>,
    pub block_bytes_hash: [u8; 32],
}

impl NeuroBlock {
    pub fn channel_count(&self) -> usize {
        self.input_channels.len()
    }
}

pub fn load_block_json(raw: &str) -> Result<NeuroBlock, BlockError> {
    let parsed: BlockJson = serde_json::from_str(raw)?;
    let n = parsed.neuron_count as usize;
    if parsed.csr_offsets.len() != n + 1 {
        return Err(BlockError::Invalid("csrOffsets length".into()));
    }
    if parsed.csr_pres.len() != parsed.csr_weights.len() {
        return Err(BlockError::Invalid("csr pres/weights mismatch".into()));
    }
    let last = *parsed.csr_offsets.last().unwrap() as usize;
    if last != parsed.csr_pres.len() {
        return Err(BlockError::Invalid("csrOffsets last != nnz".into()));
    }
    if parsed.schema != "synapsevm.blockbytes.v1" { return Err(BlockError::Invalid("unsupported schema".into())); }
    if n == 0 || n > 1_000_000 || parsed.csr_offsets[0] != 0 || parsed.csr_offsets.windows(2).any(|w| w[0] > w[1]) || parsed.csr_pres.iter().any(|&i| i as usize >= n) {
        return Err(BlockError::Invalid("invalid CSR indices or neuron count".into()));
    }
    let mut names = std::collections::HashSet::new();
    if parsed.input_channels.iter().any(|c| c.name.is_empty() || !names.insert(&c.name) || c.targets.iter().any(|&i| i as usize >= n)) || [&parsed.output_channels.danger, &parsed.output_channels.avoid_left, &parsed.output_channels.avoid_right, &parsed.output_channels.avoid_y, &parsed.output_channels.trigger].iter().any(|ids| ids.iter().any(|&i| i as usize >= n)) {
        return Err(BlockError::Invalid("invalid channel mapping".into()));
    }
    let block_bytes_hash = synapsevm_merkle::keccak256(raw.as_bytes());
    Ok(NeuroBlock {
        name: parsed.name,
        version: parsed.version,
        neuron_count: parsed.neuron_count,
        csr_offsets: parsed.csr_offsets,
        csr_pres: parsed.csr_pres,
        csr_weights: parsed.csr_weights,
        params: LifParams {
            leak: parsed.leak,
            threshold: parsed.threshold,
            reset: parsed.reset,
        },
        input_channels: parsed.input_channels,
        output_channels: parsed.output_channels,
        trigger_threshold: parsed.trigger_threshold,
        flywire_ids: parsed.flywire_ids,
        block_bytes_hash,
    })
}

pub fn load_block_path(path: impl AsRef<Path>) -> Result<NeuroBlock, BlockError> {
    let raw = fs::read_to_string(path)?;
    load_block_json(&raw)
}

/// Tiny dense hello block for unit tests (kept for Phase 0 regression).
pub fn hello_dense_weights() -> (usize, Vec<FixedQ16>) {
    use crate::fixed::q16;
    let n = 3usize;
    let mut weights = vec![0i32; n * n];
    weights[1 * n + 0] = q16(0.6);
    weights[2 * n + 1] = q16(0.8);
    (n, weights)
}
