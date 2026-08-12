#!/usr/bin/env bash
# Solvency Sentinel demo runbook (KeeperHub Agents Onchain)
# Verified live on Ethereum Sepolia (11155111).
# Preconditions:
#   1. KeeperHub org + API key in .env (KEEPERHUB_API_KEY)
#   2. Wallet integration (Turnkey) configured in the org
#   3. Sepolia ETH in the org wallet (SENTINEL_USER)
set -euo pipefail
cd "$(dirname "$0")/.."

CHAIN="${SENTINEL_CHAIN:-11155111}"
USER="${SENTINEL_USER:?set SENTINEL_USER (the protected address)}"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

step "0/6  Verify the KeeperHub connection (read-only)"
npm run check -- --chain "$CHAIN" --user "$USER"

step "1/6  Open the position through KeeperHub (wrap -> approve -> supply -> borrow USDC)"
node --import tsx/esm scripts/seed-position.ts

step "2/6  Borrow a second slug so HF drops below the critical threshold"
node --import tsx/esm scripts/seed-position.ts --borrow-only --borrow 15

step "3/6  Show the position health factor (read-only)"
npm run check -- --chain "$CHAIN" --user "$USER" --json

step "4/6  Full protect cycle: read -> evaluate -> ensure allowance -> simulate -> broadcast -> verify"
npm run monitor -- --chain "$CHAIN" --user "$USER" --critical 1.5 --target 2 --yes

step "5/6  Show the verified run report"
ls -t docs/runs/*.json | head -1 | xargs cat

step "6/6  Prove the rescue on-chain + the restored health factor"
HASH=$(grep -ho '"transactionHash":"0x[0-9a-f]*"' docs/runs/*.json | tail -1 | cut -d'"' -f4)
echo "rescue transaction: https://sepolia.etherscan.io/tx/$HASH"
npm run check -- --chain "$CHAIN" --user "$USER"

echo
echo "Demo complete. Paste the etherscan tx link into the submission."
