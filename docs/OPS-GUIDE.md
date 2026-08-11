# Testnet setup guide (Base Sepolia demo)

Goal: a real Aave V3 position on Base Sepolia owned by the KeeperHub org
wallet, plus test USDC in that wallet so the sentinel can repay.

## 1. KeeperHub org + wallet + API key (5 min)

1. Go to app.keeperhub.com and sign in (GitHub works).
2. Create/find your organization.
3. **Wallet integration**: Settings → Wallet → connect a wallet (Turnkey).
   Note the org wallet address — this is `SENTINEL_USER`.
4. Settings → API Keys → **Organisation** tab → create a key (`kh_...`).

## 2. Fund the org wallet with Base Sepolia ETH (2 min)

- Base Sepolia test ETH: faucet.coinbase.com (select Base Sepolia) or
  sepolia.basescan.org → faucet, or any Base Sepolia faucet.
- Send a small amount (0.05–0.1 ETH) to the org wallet for gas.

## 3. Open the position (5 min, in the browser)

1. Go to app.aave.com and enable **testnet mode** (top-right).
2. Connect the **org wallet** (same address as `SENTINEL_USER`).
3. Supply WETH (collateral) — use the Faucet tab in testnet mode for test WETH
   if the wallet has none, then supply it.
4. Borrow USDC (variable rate) against the WETH collateral.
5. Confirm the borrowed USDC now sits in the wallet (that's the repayment
   balance the sentinel will spend).

Result: position with HF ≈ 1.3–1.5, wallet holds both WETH and USDC.

## 4. Run the sentinel

```bash
cp .env.example .env
# KEEPERHUB_API_KEY=kh_...
# SENTINEL_USER=<org wallet address>
# SENTINEL_CHAIN=84532
npm run check -- --chain 84532 --user <org wallet>     # should print the HF
npm run monitor -- --chain 84532 --user <org wallet> --critical 1.2 --target 1.8 --yes
```

The sentinel reads the real HF, simulates the repay (no broadcast), then
broadcasts the actual `Pool.repay` and polls until the verified receipt lands.
`npm run watch -- ... --interval 60` keeps it protecting the position.

## Sanity checks if something fails

- `422 WALLET_NOT_CONFIGURED` → wallet integration missing (step 1.3).
- `insufficient_balance` → the org wallet has no test USDC (step 3.4) or no gas ETH (step 2).
- `wouldRevert: true` → the repay call itself would fail; check the debt asset.
- Health factor read shows zeros → wrong user address, or wallet not on Aave yet.
