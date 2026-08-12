# Testnet setup guide (Ethereum Sepolia demo)

Goal: a real Aave V3 position on Ethereum Sepolia owned by the KeeperHub org
wallet, seeded entirely through KeeperHub, then rescued by the sentinel.

Verified live: supply WETH collateral → borrow USDC → sentinel detects HF below
critical → approves USDC and repays → receipt verified on-chain. All writes
executed through the KeeperHub API (`contract-call`).

## 1. KeeperHub org + wallet + API key (5 min)

1. Go to app.keeperhub.com and sign in (GitHub works).
2. Create/find your organization.
3. **Wallet integration**: Settings → Wallet → connect a wallet (Turnkey).
   Note the org wallet address — this is `SENTINEL_USER`.
4. Settings → API Keys → **Organisation** tab → create a key (`kh_...`).

## 2. Fund the org wallet with Sepolia ETH (2 min)

- Any Sepolia faucet / any source of Sepolia ETH (e.g. your own wallet that
  holds Sepolia ETH, or sepoliafaucet, or a testnet bridge).
- Send 0.05–0.1 ETH to the org wallet. This covers the WETH wrap and gas.

## 3. Configure

```bash
cp .env.example .env
# KEEPERHUB_API_KEY=kh_...
# SENTINEL_USER=<org wallet address>
# SENTINEL_CHAIN=11155111
# SENTINEL_CRITICAL_HF=1.5
# SENTINEL_TARGET_HF=2
```

## 4. Open the position through KeeperHub (one command)

```bash
node --import tsx/esm scripts/seed-position.ts
# wraps 0.04 ETH -> WETH (WETH.deposit, payable — the KeeperHub `value` field
# takes ETH units, not wei)
# approves WETH for the Aave pool (0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951)
# supplies 0.02 WETH as collateral
# borrows 35 USDC (variable) -> wallet now holds 35 USDC
```

Borrow until the health factor sits below your critical threshold (e.g. borrow a
second slug: `--borrow-only --borrow 15`). Target: HF ≈ 1.2–1.4.

Check with:
```bash
npm run check -- --chain 11155111 --user <org wallet>   # should print HF < critical
```

## 5. Run the sentinel

```bash
npm run monitor -- --chain 11155111 --user <org wallet> --critical 1.5 --target 2 --yes
```

The sentinel reads the real HF, finds the debt asset via the Aave data provider,
checks the wallet's balance and allowance, **approves if needed**, simulates the
repay (no broadcast), then broadcasts the actual `Pool.repay` and polls until
the verified receipt lands. `npm run watch -- ... --interval 60` keeps it
protecting the position.

## Why this exact asset set (what we learned on Sepolia)

- WETH on Sepolia Aave is `0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c` (WETH9 —
  wrap via `deposit{value}`). **Borrowing WETH is disabled** on Sepolia
  (`Error(30)`), so the debt asset must be one of DAI / LINK / USDC / EURS /
  GHO (borrowable) — USDC works best for the demo.
- Aave Sepolia mock assets have a public `mint`, but the KeeperHub contract-call
  encoder rejects the ambiguous `mint(address,uint256)`/`mint(uint256)` pair, so
  we don't rely on minting: the sentinel repays with the wallet's own borrowed
  balance, capping the repayment at the available amount (interest accrues
  faster than the fresh principal, so repaying `MAX_UINT256` would revert).
- `Pool.getUserReserveData` is not resolvable through KeeperHub's contract-call
  ABI store; use the Aave **data provider**
  (`0x3e9708d80f7B3e43118013075F7e95CE3AB31F31`) instead.
- KeeperHub's contract-call `value` field is in **ether units** (e.g. `"0.04"`),
  not wei.
- **KeeperHub's idempotency replay window is 24h.** Re-running the same command
  with the same task id, asset and amount inside that window returns the *old*
  execution (`idempotentReplay: true`) instead of sending a new transaction —
  the position is **not** rescued, even though the API says "completed". We got
  burned by this on the live demo: a second monitor run printed "TX CONFIRMED"
  with the previous tx hash while HF was still 1.32. Fixed two ways: (1) every
  monitor run derives a fresh `runId` and folds it into the idempotency key, so
  each invocation lands a new execution; (2) the sentinel now re-reads the
  health factor after every broadcast (`verify-position`) and reports **NOT
  rescued** — never "TX CONFIRMED" — if HF is still below critical.

## Sanity checks if something fails

- `422 WALLET_NOT_CONFIGURED` → wallet integration missing (step 1.3).
- `insufficient_balance` → the org wallet has no gas ETH (step 2).
- `wouldRevert: true` → the repay call itself would fail; check the debt asset
  and that the wallet holds it (`check-allowance` / `read-repay-balance` steps).
- Health factor read shows zeros → wrong user address, or wallet not on Aave yet.
