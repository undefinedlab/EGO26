use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, PartialEq, Eq, Hash, Default)]
pub struct Hex32(pub [u8; 32]);

impl std::fmt::Debug for Hex32 {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "0x{}", hex::encode(self.0))
    }
}

impl Hex32 {
    pub fn to_hex(&self) -> String {
        format!("0x{}", hex::encode(self.0))
    }

    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }
}

impl Serialize for Hex32 {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_hex())
    }
}

impl<'de> Deserialize<'de> for Hex32 {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let s = String::deserialize(deserializer)?;
        let s = s.strip_prefix("0x").unwrap_or(&s);
        let bytes = hex::decode(s).map_err(serde::de::Error::custom)?;
        if bytes.len() != 32 {
            return Err(serde::de::Error::custom("expected 32 bytes"));
        }
        let mut arr = [0u8; 32];
        arr.copy_from_slice(&bytes);
        Ok(Hex32(arr))
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct TraceEvent {
    pub tick: u64,
    pub neuron_id: u32,
    pub spike: bool,
    pub voltage_bucket: Option<i32>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NeuroReceipt {
    pub schema: String,
    pub receipt_id: String,
    pub block_root: Hex32,
    pub stack_root: Hex32,
    pub device_id: String,
    pub sequence: u64,
    pub local_timestamp_us: u64,
    pub tick: u64,
    pub input_root: Hex32,
    pub encoded_input_root: Hex32,
    pub state_before_root: Hex32,
    pub trace_root: Hex32,
    pub state_after_root: Hex32,
    pub action_type: String,
    pub action_data_hash: Hex32,
    pub previous_receipt_hash: Hex32,
    pub runtime_hash: Hex32,
    pub signature_scheme: String,
    pub signature: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LoomGuardOutput {
    pub danger: i32,
    pub avoid_x: i32,
    pub avoid_y: i32,
    pub trigger: bool,
}
