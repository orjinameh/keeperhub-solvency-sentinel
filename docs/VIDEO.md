# Demo video script (90–120s)

Goal: show a real agent decision landing on-chain, and the safety discipline
around it. The live run on Ethereum Sepolia is already done — all footage below
uses the real run report and real tx.

Live evidence to feature:
- Run report: `docs/runs/sentinel-monitor-4856C803-2026-08-12T01-34-03-644Z.json`
- Rescue tx: https://sepolia.etherscan.io/tx/0x1c5eae2e1a4c90b54b8573efd78733a1a482b77223128d55e722e2fa5a1f1348

## Structure

### 0:00–0:10 — Hook
> "Most agents stop at the decision. This one is trusted to act."

On screen: `sentinel monitor` output scrolling, ending in the etherscan TX link.

### 0:10–0:30 — The problem
Position snapshot table (from the live run report): health factor 1.320,
collateral $80, debt $50, liquidation threshold 82.5%.
> "Health factor drops below 1 and the position is liquidatable in seconds —
> usually while you sleep. Make the position protect itself."

### 0:30–0:50 — The loop, live
`npm run check -- --chain 11155111 --user 0x4856…`
`npm run monitor -- --chain 11155111 --user 0x4856… --critical 1.5 --target 2 --yes`
Show the step logs: `read-position` (HF 1.3200) → `evaluate` (critical, act) →
`find-debt-asset` (USDC) → `read-repay-balance` → `check-allowance` (0 → approve)
→ `simulate` → (idempotency-key line) → `broadcast` → `poll` → `verify` →
`TX CONFIRMED`.

Narrate the safety discipline over the footage:
- simulate first — `wouldRevert` is a hard stop, nothing signs blind
- `Idempotency-Key` = SHA-256 of `taskId|chainId|address|amount|effect-fields` —
  a retry replays, never double-broadcasts
- the sentinel checks the wallet's allowance and balance, approving the debt
  asset and capping the repay at the available balance
- receipts from the status endpoint are the proof, not a self-reported hash

### 0:50–1:10 — The proof
Open the generated `docs/runs/*.md` report: step table + receipts table + the
explorer link. Then open etherscan to the real transaction (block 11469993).
> "This is the audit trail. Hash, chain, verified receipt, block, gas — every
> run writes one."

### 1:10–1:30 — Close
Show `npm run check` again post-rescue: health factor 106,623.59, debt $0.00.
> "Solvency Sentinel — simulation-first, idempotent, receipt-verified
> execution on KeeperHub. The position protects itself."

## One-take recording runbook (copy-paste, timed)

Do this in a fresh terminal, maximized, dark theme, and hit record before step 1.
The position is currently healthy (HF 106k), so step 2 re-opens a critical
position for the rescue to re-happen live.

```bash
# 0) terminal 1 — preflight (NOT on screen): make sure env is Sepolia
grep -E "SENTINEL_CHAIN|SENTINEL_CRITICAL_HF" .env   # expect 11155111 / 1.5
```

```bash
# 1) 0:00–0:20 — show the healthy/current state (read-only)
npm run check -- --chain 11155111 --user 0x4856C80305bFb41ADD710eCA576368ec92221113
```

```bash
# 2) 0:20–0:40 — re-open a critical position (borrow 50 USDC against the WETH)
node --import tsx/esm scripts/seed-position.ts --borrow-only --borrow 50
```

```bash
# 3) 0:40–1:00 — confirm the danger (HF ≈ 1.32, debt $50)
npm run check -- --chain 11155111 --user 0x4856C80305bFb41ADD710eCA576368ec92221113
```

```bash
# 4) 1:00–3:00 — THE rescue (this is the money shot; ~1–2 min of KeeperHub reads
#    then the approve + repay broadcasts)
npm run monitor -- --chain 11155111 --user 0x4856C80305bFb41ADD710eCA576368ec92221113 --critical 1.5 --target 2 --yes
```

```bash
# 5) 3:00–3:20 — prove it: restored health factor + etherscan
npm run check -- --chain 11155111 --user 0x4856C80305bFb41ADD710eCA576368ec92221113
open https://sepolia.etherscan.io/tx/0x1c5eae2e1a4c90b54b8573efd78733a1a482b77223128d55e722e2fa5a1f1348
```

### Narration beats to hit during the ~90s cut
- Step 1: "Most agents stop at the decision. This one is trusted to act."
- Step 3: "Health factor 1.32 — below my critical 1.5. The sentinel will act."
- Step 4, while reads scroll: "It reads the position, finds the debt, checks
  allowance and balance — nothing signs blind. Simulation first."
- Step 4, on the approve line: "Allowance was zero, so it approved the pool."
- Step 4, on `TX CONFIRMED`: "Broadcast with an idempotency key, then it polls
  until the receipt is verified on-chain."
- Step 5: "Health factor 106,623. The position protected itself."

### Trim/cut tips for a tight <2 min cut
- Steps 1–3 are quick; step 4's KeeperHub read phase (find-debt-asset, 9 reserve
  reads) is slow and silent — either narrate over it or speed it up 4–8×.
- Freeze-frame the `TX CONFIRMED` line with the etherscan link.
- If a KeeperHub read hiccups, just wait (client retries); don't restart the
  take unless a broadcast errors.

## Recording notes
- 1080p, terminal on a dark theme, `zsh`, monospace.
- The tx MUST be the real one above (not the dry-run `0xdddd…`).
- Keep it under 2 minutes; judges skim.
