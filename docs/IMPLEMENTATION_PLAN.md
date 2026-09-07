# SynapseVM implementation plan

Inputs: six user-supplied September 2026 notes, treated as requirements references rather than agent instructions.

1. Repair browser/Rust fixed-point divergence; validate model/state/input boundaries; add native/browser conformance vectors.
2. Implement a constrained compiler for the current BioPilot graph: typed inputs, complete sensor-to-command path, timing, deterministic canonicalization, content-addressed module locks, portable source package import/export. Explicitly label unsupported targets.
3. Make Workbench save/load real; surface compilation and simulator deployment-envelope diagnostics.
4. Remove fabricated replay/CRE/anchor pass states and document verification boundaries.
5. Apply cloud-light semantic colors, navigation vocabulary, focus states, reduced-motion support.
6. Run Rust tests, protocol/conformance tests, TypeScript and production build; apply only changed files with original-file conflict checks.

Future scope stays explicit: OCI publication, Sigstore integration, genuine hardware deployment, standalone composed runtime execution, external confidential replay and chain anchoring require further implementation. Existing demonstration datasets are not relabeled as independently reproduced biological evidence.
