# Local Library

Open /explore to browse versioned neural artifacts by kind, publisher, task, source and saved collection. Bundled examples and source references are explicitly distinguished from local publications.

Local publishing supports NeuroBlock block.json files and NeuroStack .synapse source packages. Start with a bundled Block or fork an exact release. Validate and preview before publishing. Releases are stored under .synapse-library/ in the VM root (override with SYNAPSEVM_LIBRARY_DIR). Keep this directory to retain publications across restarts. It is ignored by Git. Namespaces are self-declared; no account or public registry is connected.

Versions use numeric major.minor.patch and cannot be overwritten. File inventories and model digests are shown separately. NeuroBlock test vectors run local smoke executions, not independent replay attestation. Source stacks are not executable compiled stacks. Dataset and circuit records currently link provenance references, not hosted datasets.

Run npm run test:library for publication, version, fork, filtering and integrity checks. Run npm run build:lab for the frontend production build.
