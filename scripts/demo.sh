#!/usr/bin/env bash
# Solvency Sentinel demo runbook (KeeperHub Agents Onchain)
# Preconditions:
#   1. KeeperHub org + API key in .env (KEEPERHUB_API_KEY)
#   2. Wallet integration (Turnkey) configured in the org
#   3. Base Sepolia Aave V3 position for $SENTINEL_USER (supply collateral + borrow a debt asset)
#   4. Org wallet holds the debt asset (faucet) + a little test ETH for gas
set -euo pipefail
cd "$(dirname "$0")/.."

CHAIN="${SENTINEL_CHAIN:-84532}"
USER="${SENTINEL_USER:?set SENTINEL_USER (the protected address)}"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

step "0/5  Verify the KeeperHub connection (read-only)"
npm run check -- --chain "$CHAIN" --user "$USER"

step "1/5  Show the position health factor (read-only)"
npm run check -- --chain "$CHAIN" --user "$USER" --json

step "2/5  Preflight ONLY: simulate the rescue (never broadcasts)"
npm run monitor -- --chain "$CHAIN" --user "$USER" --critical 9 --target 9.5 --yes \
  || true

step "3/5  Full protect cycle: read -> evaluate -> simulate -> broadcast -> verify"
npm run monitor -- --chain "$CHAIN" --user "$USER" --critical 1.2 --target 1.8 --yes

step "4/5  Show the verified run report"
ls -t docs/runs/*.json | head -1 | xargs cat

step "5/5  Prove the tx on-chain"
HASH=$(grep -ho '"transactionHash":"0x[0-9a-f]*"' docs/runs/*.json | tail -1 | cut -d'"' -f4)
echo "transaction: https://sepolia.basescan.org/tx/$HASH"

echo
echo "Demo complete. Paste the basescan tx link into the submission."
