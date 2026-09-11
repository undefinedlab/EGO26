#!/usr/bin/env bash
# Load VM/contracts/.env and deploy NeuroRegistry with Foundry.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

RPC="${SEPOLIA_RPC_URL:-${RPC_URL:-}}"
KEY="${FOUNDATION_KEY:-${PRIVATE_KEY:-}}"

if [[ -z "$RPC" ]]; then
  echo "Missing SEPOLIA_RPC_URL in contracts/.env"
  echo "Add an Alchemy/Infura Sepolia HTTPS URL, then re-run."
  exit 1
fi
if [[ -z "$KEY" ]]; then
  echo "Missing PRIVATE_KEY / FOUNDATION_KEY in contracts/.env"
  exit 1
fi

BAL=$(cast balance "$(cast wallet address --private-key "$KEY")" --rpc-url "$RPC" || true)
echo "Deployer balance (wei): ${BAL:-unknown}"

ADDR=$(forge create NeuroRegistry.sol:NeuroRegistry \
  --rpc-url "$RPC" \
  --private-key "$KEY" \
  --json | sed -n 's/.*"deployedTo":"\([^"]*\)".*/\1/p')

if [[ -z "$ADDR" ]]; then
  echo "Deploy failed."
  exit 1
fi

BLOCK=$(cast block-number --rpc-url "$RPC")
mkdir -p deployments
cat > deployments/sepolia.json <<EOF
{
  "network": "sepolia",
  "contract": "NeuroRegistry",
  "address": "$ADDR",
  "startBlock": $BLOCK,
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# Point the subgraph at the live registry
SUBGRAPH_DIR="$ROOT/../graph/synapsevm-subgraph"
if [[ -d "$SUBGRAPH_DIR" ]]; then
  node <<NODE
const fs = require('fs');
const path = require('path');
const dir = process.env.SUBGRAPH_DIR || '$SUBGRAPH_DIR';
const addr = '$ADDR'.toLowerCase();
const start = $BLOCK;
const networks = {
  sepolia: { NeuroRegistry: { address: addr, startBlock: start } }
};
fs.writeFileSync(path.join(dir, 'networks.json'), JSON.stringify(networks, null, 2) + '\n');
let yaml = fs.readFileSync(path.join(dir, 'subgraph.yaml'), 'utf8');
yaml = yaml.replace(/address: "0x[0-9a-fA-F]{40}"/, 'address: "' + addr + '"');
yaml = yaml.replace(/startBlock: \\d+/, 'startBlock: ' + start);
fs.writeFileSync(path.join(dir, 'subgraph.yaml'), yaml);
console.log('Updated subgraph address + startBlock');
NODE
fi

echo ""
echo "NeuroRegistry deployed at $ADDR"
echo "startBlock ≈ $BLOCK (written to deployments/sepolia.json)"
echo "Next: fund done — run subgraph codegen/build/deploy when Studio token is ready."
