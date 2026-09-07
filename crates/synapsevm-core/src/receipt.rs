use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use rand_core::OsRng;
use serde_json::json;
use synapsevm_merkle::keccak256;
use synapsevm_types::{Hex32, NeuroReceipt};

use crate::vm::runtime_hash;

pub struct ReceiptBuilder {
    pub device_id: String,
    pub sequence: u64,
    pub signing_key: SigningKey,
    pub previous: Hex32,
}

impl ReceiptBuilder {
    pub fn new(device_id: impl Into<String>) -> Self {
        let signing_key = SigningKey::generate(&mut OsRng);
        Self {
            device_id: device_id.into(),
            sequence: 0,
            signing_key,
            previous: Hex32::default(),
        }
    }

    pub fn from_seed(device_id: impl Into<String>, seed: [u8; 32]) -> Self {
        Self {
            device_id: device_id.into(),
            sequence: 0,
            signing_key: SigningKey::from_bytes(&seed),
            previous: Hex32::default(),
        }
    }

    pub fn verifying_key_bytes(&self) -> [u8; 32] {
        self.signing_key.verifying_key().to_bytes()
    }
}

pub fn hash_receipt_chain(
    block_root: &Hex32,
    input_root: &Hex32,
    state_before: &Hex32,
    trace_root: &Hex32,
    state_after: &Hex32,
    action_data_hash: &Hex32,
    previous: &Hex32,
) -> Hex32 {
    let mut buf = Vec::with_capacity(32 * 7);
    for h in [
        block_root,
        input_root,
        state_before,
        trace_root,
        state_after,
        action_data_hash,
        previous,
    ] {
        buf.extend_from_slice(&h.0);
    }
    Hex32(keccak256(&buf))
}

pub fn sign_receipt_bytes(key: &SigningKey, message: &[u8]) -> String {
    let sig: Signature = key.sign(message);
    format!("0x{}", hex::encode(sig.to_bytes()))
}

pub fn verify_receipt_signature(vk: &VerifyingKey, message: &[u8], sig_hex: &str) -> bool {
    let s = sig_hex.strip_prefix("0x").unwrap_or(sig_hex);
    let Ok(bytes) = hex::decode(s) else {
        return false;
    };
    let Ok(arr) = <[u8; 64]>::try_from(bytes.as_slice()) else {
        return false;
    };
    let sig = Signature::from_bytes(&arr);
    vk.verify(message, &sig).is_ok()
}

pub fn build_receipt(
    builder: &mut ReceiptBuilder,
    block_root: Hex32,
    stack_root: Hex32,
    tick: u64,
    input_root: Hex32,
    encoded_input_root: Hex32,
    state_before: Hex32,
    trace_root: Hex32,
    state_after: Hex32,
    action_type: &str,
    action_data: &[u8],
    local_timestamp_us: u64,
) -> NeuroReceipt {
    let action_data_hash = Hex32(keccak256(action_data));
    let receipt_id = hash_receipt_chain(
        &block_root,
        &input_root,
        &state_before,
        &trace_root,
        &state_after,
        &action_data_hash,
        &builder.previous,
    );
    builder.sequence += 1;
    let mut receipt = NeuroReceipt {
        schema: "synapsevm.neuroreceipt.v2".into(),
        receipt_id: receipt_id.to_hex(),
        block_root,
        stack_root,
        device_id: builder.device_id.clone(),
        sequence: builder.sequence,
        local_timestamp_us,
        tick,
        input_root,
        encoded_input_root,
        state_before_root: state_before,
        trace_root,
        state_after_root: state_after,
        action_type: action_type.into(),
        action_data_hash,
        previous_receipt_hash: builder.previous,
        runtime_hash: runtime_hash(),
        signature_scheme: "ed25519".into(),
        signature: String::new(),
    };
    receipt.receipt_id.clear();
    let receipt_id = Hex32(keccak256(&canonical_receipt_message(&receipt)));
    receipt.receipt_id = receipt_id.to_hex();
    let message = canonical_receipt_message(&receipt);
    receipt.signature = sign_receipt_bytes(&builder.signing_key, &message);
    builder.previous = receipt_id;
    receipt
}

pub fn canonical_receipt_message(r: &NeuroReceipt) -> Vec<u8> {
    let v = json!({
        "schema": r.schema,
        "receiptId": r.receipt_id,
        "blockRoot": r.block_root.to_hex(),
        "stackRoot": r.stack_root.to_hex(),
        "deviceId": r.device_id,
        "sequence": r.sequence,
        "tick": r.tick,
        "localTimestampUs": r.local_timestamp_us,
        "encodedInputRoot": r.encoded_input_root.to_hex(),
        "signatureScheme": r.signature_scheme,
        "inputRoot": r.input_root.to_hex(),
        "stateBeforeRoot": r.state_before_root.to_hex(),
        "traceRoot": r.trace_root.to_hex(),
        "stateAfterRoot": r.state_after_root.to_hex(),
        "actionType": r.action_type,
        "actionDataHash": r.action_data_hash.to_hex(),
        "previousReceiptHash": r.previous_receipt_hash.to_hex(),
        "runtimeHash": r.runtime_hash.to_hex(),
    });
    serde_json::to_vec(&v).expect("json")
}
