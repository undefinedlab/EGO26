# Explore → Compose → Compile → Simulate

Explore selects a versioned Library release. Compatible four-channel reflex Blocks offer **Use in Compose**; Compose retrieves that exact release and checks its model digest. Users can add the Block to their existing graph or start a connected Collision Shield with it. Published `.synapse` Stacks open with their exact module bytes; bundled BioPilot opens as a source template.

Compose owns graph editing. Changes are saved synchronously in this browser, including undo and redo, so immediate navigation preserves edits. Continue to Compile carries the graph, pinned modules, and layout forward.

Compile is available at `/compile`. It checks the graph and creates a canonical package with module locks, a deterministic schedule, Stack ID, and package hash. The compiled record survives navigation and reloads in local browser storage. The fingerprint includes graph settings and retained module bytes, but excludes canvas positions. A stale record or an invalid package cannot be used as the current executable build.

Simulate at `/simulate` loads the current compiled Stack. It displays the package hash, actual actuator commands, event timeline, receipts, and replay controls. Edits require recompilation. Source-only packages stay inspectable and exportable but cannot execute. The existing bundled Block demonstrations remain at `/simulate?mode=demo` and `/simulate?block=loomguard`; they are explicitly separate from compiled Stack execution.

Stack runs use synthetic recorded features and command visualization. They are not physics or hardware benchmarks. Verify receives the exact Stack package and its captured replay evidence.

The workspace and compiled artifact are local to this browser and origin. Download the draft and package for portable copies. Changes from another tab invalidate the loaded build and stop execution; reload to load the current workspace.

Validation: `node --import tsx --test tests/workflow.test.ts tests/compose.test.ts tests/verification.test.ts`.
