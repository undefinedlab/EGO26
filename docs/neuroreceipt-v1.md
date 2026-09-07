# NeuroReceipt v1

Emitted on critical actions only (`trigger` rising edge, avoid override, …).

Hash chain:

`R[n] = H(blockRoot || inputRoot || stateBefore || traceRoot || stateAfter || actionHash || R[n-1])`

Evidence bundle: `receipt-bundles/<id>/{receipt.json,input.bin,state-before.bin,trace.bin,action.json,meta.json}`.

Replay via `synapsevm replay <bundle> <block.json>` or `POST /v1/replay`.
