use tiny_keccak::{Hasher, Keccak};

/// Ethereum-compatible keccak256 commitment.
pub fn keccak256(bytes: &[u8]) -> [u8; 32] {
    let mut hasher = Keccak::v256();
    hasher.update(bytes);
    let mut out = [0u8; 32];
    hasher.finalize(&mut out);
    out
}

/// Backward-compatible alias used across the runtime.
pub fn keccak_like_hash(bytes: &[u8]) -> [u8; 32] {
    keccak256(bytes)
}

pub fn commit_pair(left: &[u8; 32], right: &[u8; 32]) -> [u8; 32] {
    let mut buf = [0u8; 64];
    buf[..32].copy_from_slice(left);
    buf[32..].copy_from_slice(right);
    keccak256(&buf)
}

pub fn merkleize_leaves(leaves: &[[u8; 32]]) -> [u8; 32] {
    if leaves.is_empty() {
        return [0u8; 32];
    }
    let mut layer: Vec<[u8; 32]> = leaves.to_vec();
    while layer.len() > 1 {
        let mut next = Vec::with_capacity(layer.len().div_ceil(2));
        for chunk in layer.chunks(2) {
            if chunk.len() == 2 {
                next.push(commit_pair(&chunk[0], &chunk[1]));
            } else {
                next.push(commit_pair(&chunk[0], &chunk[0]));
            }
        }
        layer = next;
    }
    layer[0]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_is_stable() {
        let a = keccak256(b"synapsevm");
        let b = keccak256(b"synapsevm");
        assert_eq!(a, b);
    }
}
