use synapsevm_core::{load_block_path, init, step, snapshot, TraceMode};
fn main() {
    let mut rows = Vec::new();
    for slug in ["loomguard", "flowsense", "headingcell", "targettrack"] {
        let block = load_block_path(format!("blocks/{slug}/1.0.0/block.json")).unwrap();
        let mut state = init(&block).unwrap();
        let values = [0, -1, -32769, 9830, 9831, 16383, 16384, 36045, 65536, i32::MAX, i32::MIN];
        for tick in 0..33u64 {
            let input: Vec<i32> = (0..block.input_channels.len()).map(|i| values[(tick as usize + i) % values.len()]).collect();
            let result = step(&mut state, &input, tick, TraceMode::Sparse).unwrap();
            rows.push(serde_json::json!({"slug":slug,"tick":tick,"input":input,"output":result.output,"snapshot":hex::encode(snapshot(&state)),"trace":result.trace.iter().map(|e|e.neuron_id).collect::<Vec<_>>(),"stateRoot":result.state_root,"traceRoot":result.trace_root}));
        }
    }
    println!("{}", serde_json::to_string(&rows).unwrap());
}
