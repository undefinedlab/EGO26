# Deploy NeuroRegistry on Sepolia using contracts/.env
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$envFile = Join-Path $Root ".env"
if (-not (Test-Path $envFile)) { throw "Missing contracts/.env - generate the wallet first." }

Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
  $pair = $_.Split('=', 2)
  if ($pair.Length -eq 2) {
    [System.Environment]::SetEnvironmentVariable($pair[0].Trim(), $pair[1].Trim(), "Process")
  }
}

$Rpc = if ($env:SEPOLIA_RPC_URL) { $env:SEPOLIA_RPC_URL } else { $env:RPC_URL }
$Key = if ($env:FOUNDATION_KEY) { $env:FOUNDATION_KEY } else { $env:PRIVATE_KEY }

if (-not $Rpc) { throw "Set SEPOLIA_RPC_URL in contracts/.env" }
if (-not $Key) { throw "Missing PRIVATE_KEY in contracts/.env" }

$Addr = (& cast wallet address --private-key $Key).Trim()
Write-Host "Deployer: $Addr"
$Bal = & cast balance $Addr --rpc-url $Rpc --ether
Write-Host "Balance ETH: $Bal"

$json = & forge create NeuroRegistry.sol:NeuroRegistry --rpc-url $Rpc --private-key $Key --broadcast --json
$obj = $json | ConvertFrom-Json
$Deployed = $obj.deployedTo
if (-not $Deployed) { throw "Deploy failed: $json" }

$Tx = $obj.transactionHash
$Block = if ($Tx) {
  $receipt = (& cast receipt $Tx --rpc-url $Rpc --json) | ConvertFrom-Json
  [int]$receipt.blockNumber
} else {
  [int]((& cast block-number --rpc-url $Rpc).Trim())
}
New-Item -ItemType Directory -Force -Path (Join-Path $Root "deployments") | Out-Null
@{
  network = "sepolia"
  contract = "NeuroRegistry"
  address = $Deployed
  startBlock = $Block
  deployedAt = (Get-Date).ToUniversalTime().ToString("o")
} | ConvertTo-Json | Set-Content (Join-Path $Root "deployments\sepolia.json")

$Sub = Join-Path $Root "..\graph\synapsevm-subgraph"
if (Test-Path $Sub) {
  $networksObj = [ordered]@{
    sepolia = [ordered]@{
      NeuroRegistry = [ordered]@{
        address = $Deployed.ToLower()
        startBlock = $Block
      }
    }
  }
  ($networksObj | ConvertTo-Json -Depth 5) + "`n" | Set-Content (Join-Path $Sub "networks.json")
  $yamlPath = Join-Path $Sub "subgraph.yaml"
  $yaml = Get-Content $yamlPath -Raw
  $yaml = [regex]::Replace($yaml, 'address: "0x[0-9a-fA-F]{40}"', "address: `"$($Deployed.ToLower())`"")
  $yaml = [regex]::Replace($yaml, 'startBlock: \d+', "startBlock: $Block")
  Set-Content $yamlPath $yaml -NoNewline
  Write-Host "Updated subgraph.yaml + networks.json"
}

Write-Host ""
Write-Host "NeuroRegistry deployed at $Deployed"
Write-Host "startBlock approx $Block"
