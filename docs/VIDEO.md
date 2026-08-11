# Demo video script (90–120s)

Goal: show a real agent decision landing on-chain, and the safety discipline
around it. Use the real tx from `docs/runs/` after the live run; the `--dry-run`
footage below is placeholder until then.

## Structure

### 0:00–0:10 — Hook
> "Most agents stop at the decision. This one is trusted to act."

On screen: `sentinel monitor` output scrolling, ending in the basescan TX link.

### 0:10–0:30 — The problem
Position snapshot table (from a run report): health factor 1.02, collateral
$1,000, debt $800, liquidation threshold 80%.
> "Health factor drops below 1 and the position is liquidatable in seconds —
> usually while you sleep. Make the position protect itself."

### 0:30–0:50 — The loop, live
`npm run check -- --chain 84532 --user 0x…`
`npm run monitor -- --chain 84532 --user 0x… --critical 1.2 --target 1.8`
Show the step logs: `read-position` → `evaluate` → `find-debt-asset` →
`simulate` → (idempotency-key line) → `broadcast` → `poll` → `verify` →
`TX CONFIRMED`.

Narrate the safety discipline over the footage:
- simulate first — `wouldRevert` is a hard stop, nothing signs blind
- `Idempotency-Key` = SHA-256 of `taskId|chainId|address|amount|effect-fields` —
  a retry replays, never double-broadcasts
- receipts from the status endpoint are the proof, not a self-reported hash

### 0:50–1:10 — The proof
Open the generated `docs/runs/*.md` report: step table + receipts table + the
explorer link. Then open basescan in the browser to the real transaction.
> "This is the audit trail. Hash, chain, verified receipt, block, gas — every
> run writes one."

### 1:10–1:30 — Close
`npm run watch -- … --interval 60` (short clip of a couple of cycles).
> "Solvency Sentinel — simulation-first, idempotent, receipt-verified
> execution on KeeperHub. The position protects itself."

## Recording notes
- 1080p, terminal on a dark theme, `zsh`, monospace.
- The tx MUST be the real one from `docs/runs/` (not the dry-run `0xdddd…`).
- Keep it under 2 minutes; judges skim.
