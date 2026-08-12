# NTU InnovateX 2026 — Submission (Devpost)

> Deadline: **Aug 14, 2026**. Stage 1 is fully online — a prototype is not
> required to apply; the write-up carries the submission. Track 2 = Web3
> Applications / AI Agents. $20K pool + $1.5K Best Student.
> URL: innovatex.devpost.com

## Title
Solvency Sentinel — a self-protecting DeFi position agent

## One-liner
An autonomous agent that watches an Aave V3 lending position and, when the
health factor crosses a danger threshold, preflights, broadcasts and
**receipt-verifies** a rescue transaction through KeeperHub's execution layer —
then writes an audit trail.

## Elevator pitch (Stage 1 text)

Most "agentic finance" demos stop at the decision. Solvency Sentinel goes the
extra mile: the decision is *executed on-chain*, and the execution is engineered
to the standard you would actually trust with money.

The problem it solves is concrete: a lending position (e.g. borrowed against
collateral on Aave V3) can be liquidated in seconds when the health factor drops
below 1 — after a price move, during congestion, or while the owner sleeps. The
agent makes the position self-protecting. It continuously reads the health
factor through KeeperHub, decides with a configurable policy (healthy / watch /
critical / liquidatable), and when it acts it follows a safe-first-write
discipline:

1. **Simulate** the repay (`simulate: true` — estimateGas + call, no signature).
   Reverts and funding shortfalls are hard stops with typed, decoded reasons.
2. **Broadcast once** with an `Idempotency-Key` derived from the work itself
   (SHA-256 of a canonical `taskId|chainId|address|amount|effect-fields`), so a
   crashed retry replays the same execution instead of double-paying.
3. **Poll** `GET /api/execute/{id}/status` honoring `X-Poll-Interval-Hint` and
   treat the response's **verified receipts** as the on-chain proof.
4. **Report** — a JSON + Markdown audit trail per run with the transaction hash,
   explorer link, receipts, gas used, and every decision step.

Technical depth: custom agent loop (no heavy framework) in TypeScript, Aave V3
pool ABIs pinned per chain (Base Sepolia, Ethereum Sepolia, Base, Arbitrum,
Polygon, Ethereum), a viem-based ABI decoder for contract-call tuple reads,
canonical decimal/address/chain normalization for idempotency keys, typed error
mapping for the KeeperHub REST API (`422 WALLET_NOT_CONFIGURED`,
`400 wouldRevert`, `409 idempotency_conflict`, 403 spending caps, 429 rate
limits), and a `--dry-run` mode with an injectable execution layer so the whole
loop is unit-tested end to end (27 tests).

Why it's innovative: it inverts the failure model. Instead of asking "will the
agent do something clever?", it asks "can the agent be trusted not to do
something stupid — and to prove what it did on-chain?" Simulate-first,
idempotent, receipt-verified execution with an audit trail is the missing
production discipline for agentic finance.

## Track
Track 2 — Web3 Applications / AI Agents

## Category tags
Web3 · AI Agents · DeFi · Automation

## How it works (diagram text)
Sentinel loop → KeeperHub Direct Execution API (contract-call) → Aave V3 Pool
(getUserAccountData / getReservesList / getUserReserveData / repay) → verified
receipts → run report.

## Prize fit
Best Student ($1.5K) eligible — solo student builder. $20K main pool for the
strongest web3/AI-agent application.

## Submission assets
- GitHub repo (public): https://github.com/orjinameh/keeperhub-solvency-sentinel
- Demo video (see `docs/VIDEO.md`)
- **Real on-chain tx executed via KeeperHub**:
  https://sepolia.etherscan.io/tx/0x1c5eae2e1a4c90b54b8573efd78733a1a482b77223128d55e722e2fa5a1f1348
  (Ethereum Sepolia — the sentinel detected health factor 1.320 below its
  critical 1.5 policy, auto-approved the debt asset and repaid 50 USDC on Aave
  V3. Receipt verified at block 11469993, `receiptStatus success`. Full audit
  trail: `docs/runs/sentinel-monitor-4856C803-2026-08-12T01-34-03-644Z.json`;
  post-rescue health factor 106,623.59, debt $0.00.)
- A second rescue was driven **through the MCP server** (the ChatGPT/Claude
  interface) on the same position: `sentinel_monitor` over MCP stdio →
  KeeperHub → on-chain repay → HF 1.320 → 43,737.57
  (`0x7a757600f94835a0f8e6a1787ca936ff0047b83ca6b360becb540d269e9b23b7`).
  Walkthrough: `docs/CHATGPT-MCP.md`.
- Onboarding bounty submission (stackable): `docs/BUILDER-TEARDOWN.md`.
