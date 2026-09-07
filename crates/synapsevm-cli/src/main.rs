use std::env;
use std::fs;
use std::path::PathBuf;
use std::process;
use std::time::Instant;

use synapsevm_core::{
    init, load_block_path, q16, replay_evidence_bundle, run_loomguard_scenario, step, TraceMode,
};

fn main() {
    let mut args = env::args().skip(1).collect::<Vec<_>>();
    if args.is_empty() {
        eprintln!("usage: synapsevm <run-loomguard|replay|bench> ...");
        process::exit(2);
    }
    let cmd = args.remove(0);
    match cmd.as_str() {
        "run-loomguard" => {
            let block = args
                .first()
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("blocks/loomguard/1.0.0/block.json"));
            let out = args
                .get(1)
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("receipt-bundles"));
            let seed: u64 = args.get(2).and_then(|s| s.parse().ok()).unwrap_or(42);
            let obstacle: u64 = args.get(3).and_then(|s| s.parse().ok()).unwrap_or(40);
            let (receipt, bundle, ok) = run_loomguard_scenario(&block, seed, obstacle, 200, &out);
            println!(
                "{}",
                serde_json::json!({
                    "ok": ok,
                    "action": receipt.action_type,
                    "tick": receipt.tick,
                    "receiptId": receipt.receipt_id,
                    "bundle": bundle,
                    "stateAfterRoot": receipt.state_after_root,
                })
            );
            if !ok {
                process::exit(1);
            }
        }
        "replay" => {
            if args.len() < 2 {
                eprintln!("usage: synapsevm replay <bundleDir> <block.json>");
                process::exit(2);
            }
            let result = replay_evidence_bundle(&args[0], &args[1]);
            println!("{}", serde_json::to_string_pretty(&result).unwrap());
            if !result.valid {
                process::exit(1);
            }
        }
        "bench" => {
            let block_path = args
                .first()
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("blocks/loomguard/1.0.0/block.json"));
            let block = load_block_path(&block_path).expect("block");
            let artifact_bytes = fs::metadata(&block_path).map(|m| m.len()).unwrap_or(0)
                + fs::metadata(block_path.with_file_name("weights.bin"))
                    .map(|m| m.len())
                    .unwrap_or(0)
                + fs::metadata(block_path.with_file_name("topology.bin"))
                    .map(|m| m.len())
                    .unwrap_or(0);
            let mut state = init(&block).unwrap();
            let warmup = 20u64;
            let samples = 200u64;
            for tick in 0..warmup {
                let _ = step(
                    &mut state,
                    &[q16(0.2), q16(0.1), q16(0.1), q16(0.3)],
                    tick,
                    TraceMode::Off,
                );
            }
            let mut times = Vec::with_capacity(samples as usize);
            let mut spikes = 0u64;
            for tick in 0..samples {
                let t0 = Instant::now();
                let r = step(
                    &mut state,
                    &[q16(0.4), q16(0.2), q16(0.2), q16(0.6)],
                    warmup + tick,
                    TraceMode::Off,
                )
                .unwrap();
                times.push(t0.elapsed().as_secs_f64() * 1000.0);
                spikes += r.fired_count as u64;
            }
            times.sort_by(|a, b| a.partial_cmp(b).unwrap());
            let avg = times.iter().sum::<f64>() / times.len() as f64;
            let p50 = times[times.len() / 2];
            let p95 = times[((times.len() as f64 * 0.95) as usize).min(times.len() - 1)];
            let report = serde_json::json!({
                "block": format!("{}@{}", block.name, block.version),
                "neuronCount": block.neuron_count,
                "artifactBytes": artifact_bytes,
                "samples": samples,
                "avgTickMs": avg,
                "p50TickMs": p50,
                "p95TickMs": p95,
                "avgSpikesPerTick": spikes as f64 / samples as f64,
                "networkCallsPerTick": 0,
                "baselines": {
                    "classicalControllerTickMs": 0.01,
                    "llmAgentProxyBilledMsPerDecision": 320,
                    "note": "LLM baseline is a latency proxy for cloud agent loops, not an intelligence claim"
                }
            });
            let out_dir = PathBuf::from("benchmarks");
            fs::create_dir_all(&out_dir).ok();
            fs::write(
                out_dir.join("latest.json"),
                serde_json::to_vec_pretty(&report).unwrap(),
            )
            .ok();
            let web = PathBuf::from("apps/neurolab-web/public/benchmarks");
            fs::create_dir_all(&web).ok();
            fs::write(
                web.join("latest.json"),
                serde_json::to_vec_pretty(&report).unwrap(),
            )
            .ok();
            println!("{}", serde_json::to_string_pretty(&report).unwrap());
        }
        _ => {
            eprintln!("unknown command {cmd}");
            process::exit(2);
        }
    }
}
