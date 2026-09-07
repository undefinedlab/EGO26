# NeuroBlock v1

Portable unit layout (see also builder spec §4):

```
blocks/<name>/<version>/
  manifest.json      # includes blockRoot
  block.json         # SynapseVM executable bytes (CSR + adapters)
  topology.bin
  weights.bin
  provenance.json    # connectomic vs dynamics vs adapters
  adapters/
  test-vectors/
```

`blockRoot = keccak256(canonical(manifest_without_root) || artifact hashes)`.
