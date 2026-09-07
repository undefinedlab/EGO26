# SynapseVM

> The verified nervous system for autonomous machines.

## Status

The local demonstration path is: **FlyWire LoomGuard → local reflex → NeuroReceipt → replay**.

| Check | Command |
|---|---|
| Determinism | `cargo test -p synapsevm-core` |
| LoomGuard E2E (spec §26 local) | `cargo test -p synapsevm-core --test loomguard_e2e` |
| Package blocks | `npm run compile:loomguard && npm run compile:library` |
| Bench (measured) | `npm run bench` |
| NeuroLab | `npm run dev:lab` |
| Validator | `npm run dev:validator` |

## Hard rule

No chain / CRE / payment in the reflex path.

## September architecture update

See [implementation status](docs/IMPLEMENTATION_STATUS.md), [execution contract](docs/SYNAPSEVM_EXECUTION_SPEC.md), and [implementation plan](docs/IMPLEMENTATION_PLAN.md). Workbench now exports deterministic source packages and validates timing and ports. Source packages are not executable composed Stacks. Run `npm run test:protocol` for native/browser conformance. New strict replay uses receipt v2; older bundles remain available as legacy evidence. Install Python compiler dependencies with `python -m pip install -r compiler/requirements.txt`.
