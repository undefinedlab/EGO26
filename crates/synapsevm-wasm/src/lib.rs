//! Browser WASM API (builder spec §19.1).

use synapsevm_core::{
    init, load_block_json, snapshot, state_root_of, step, HelloBlock, NeuroBlock, StepResult,
    TraceMode, VmState,
};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct BlockHandle {
    state: VmState,
}

#[wasm_bindgen]
pub fn load_hello() -> Result<BlockHandle, JsValue> {
    let block = HelloBlock::build();
    let state = init(&block).map_err(|e| JsValue::from_str(&e.to_string()))?;
    Ok(BlockHandle { state })
}

#[wasm_bindgen]
pub fn load_block_json_str(json: &str) -> Result<BlockHandle, JsValue> {
    let block = load_block_json(json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let state = init(&block).map_err(|e| JsValue::from_str(&e.to_string()))?;
    Ok(BlockHandle { state })
}

#[wasm_bindgen]
impl BlockHandle {
    pub fn reset(&mut self) -> Result<(), JsValue> {
        let block = self.state.block.clone();
        self.state = init(&block).map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(())
    }

    pub fn step(&mut self, input: &[i32], tick: u64) -> Result<JsValue, JsValue> {
        let result = step(&mut self.state, input, tick, TraceMode::Sparse)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        serde_wasm_bindgen::to_value(&StepView::from(result))
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn snapshot(&self) -> Vec<u8> {
        snapshot(&self.state)
    }

    pub fn state_root(&self) -> String {
        state_root_of(&self.state).to_hex()
    }

    pub fn neuron_count(&self) -> u32 {
        self.state.block.neuron_count
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct StepView {
    output: Vec<i32>,
    danger: i32,
    avoid_x: i32,
    avoid_y: i32,
    trigger: bool,
    state_root: String,
    trace_root: String,
    fired_count: u32,
    trace_neuron_ids: Vec<u32>,
}

impl From<StepResult> for StepView {
    fn from(r: StepResult) -> Self {
        Self {
            output: r.output,
            danger: r.loom.danger,
            avoid_x: r.loom.avoid_x,
            avoid_y: r.loom.avoid_y,
            trigger: r.loom.trigger,
            state_root: r.state_root.to_hex(),
            trace_root: r.trace_root.to_hex(),
            fired_count: r.fired_count,
            trace_neuron_ids: r.trace.iter().map(|t| t.neuron_id).collect(),
        }
    }
}

/// Native helper for non-wasm callers / tests.
pub fn load_native(block: NeuroBlock) -> VmState {
    init(&block).expect("init")
}
