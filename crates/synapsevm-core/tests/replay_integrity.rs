use std::{fs,path::PathBuf};
use synapsevm_core::{run_loomguard_scenario,replay_evidence_bundle,load_block_json,init,snapshot,restore,HelloBlock};
#[test]
fn tampering_never_passes_replay() {
 let root=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
 let block=root.join("blocks/loomguard/1.0.0/block.json");
 let out=std::env::temp_dir().join(format!("synapsevm-integrity-{}",std::process::id()));
 let (_,bundle,_)=run_loomguard_scenario(&block,42,40,200,&out);
 assert!(replay_evidence_bundle(&bundle,&block).valid);
 let receipt_path=bundle.join("receipt.json");let raw=fs::read(&receipt_path).unwrap();
 for field in ["blockRoot","stackRoot","inputRoot","encodedInputRoot","stateBeforeRoot","traceRoot","stateAfterRoot","actionDataHash","runtimeHash","previousReceiptHash"] {
  let mut r:serde_json::Value=serde_json::from_slice(&raw).unwrap();r[field]=serde_json::json!(format!("0x{}","ff".repeat(32)));
  fs::write(&receipt_path,serde_json::to_vec(&r).unwrap()).unwrap();assert!(!replay_evidence_bundle(&bundle,&block).valid,"{field}");
 }
 for field in ["tick","sequence","localTimestampUs"] {let mut r:serde_json::Value=serde_json::from_slice(&raw).unwrap();r[field]=serde_json::json!(9999);fs::write(&receipt_path,serde_json::to_vec(&r).unwrap()).unwrap();assert!(!replay_evidence_bundle(&bundle,&block).valid,"{field}");}
 fs::write(&receipt_path,&raw).unwrap();
 let mut input=fs::read(bundle.join("input.bin")).unwrap();input.push(1);fs::write(bundle.join("input.bin"),input).unwrap();assert!(!replay_evidence_bundle(&bundle,&block).valid);
 fs::remove_dir_all(out).unwrap();
}
#[test]
fn malformed_model_and_snapshot_are_rejected() {
 let root=PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
 let raw=fs::read_to_string(root.join("blocks/loomguard/1.0.0/block.json")).unwrap();
 let mut block:serde_json::Value=serde_json::from_str(&raw).unwrap();block["csrOffsets"][0]=serde_json::json!(1);
 assert!(load_block_json(&block.to_string()).is_err());
 let mut state=init(&HelloBlock::build()).unwrap();let initial=snapshot(&state);let mut bad=initial.clone();bad[16]=2;
 assert!(restore(&mut state,&bad).is_err());assert_eq!(snapshot(&state),initial);
}
