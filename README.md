# Solvency Sentinel

An autonomous agent that protects a DeFi lending position and proves every
transaction it sends on-chain — through KeeperHub as the execution layer.

**Story in one line:** watch Aave V3 health factor → decide the rescue action →
**simulate** it → **broadcast idempotently** → **poll until a verified receipt**
lands on-chain → write an audit-trail run report.

Built for the **KeeperHub Agents Onchain Hackathon**. Real transactions are
executed via the KeeperHub Direct Execution API.

---

## Why KeeperHub is the execution layer

This project is deliberately built on KeeperHub's Direct Execution + idempotency
contract rather than hand-rolled `sendRawTransaction`, because a protective
financial agent has exactly the failure modes KeeperHub's API is designed to kill:

| Risk | What Solvency Sentinel does about it |
| --- | --- |
| Reverts / bad ABI / allowance bugs hitting mainnet | **Simulate first** — `simulate: true` dry-runs with `provider.estimateGas` + `provider.call`, no signature, no broadcast |
| Double-execution after a client crash / timeout | **Idempotency-Key** — a SHA-256 digest of `taskId\|chainId\|address\|amount\|effect-fields`, so a retry returns the *same* execution instead of a second tx |
| Trusting a self-reported tx hash | **Receipts** — poll `GET /api/execute/{id}/status` (honoring `X-Poll-Interval-Hint`) and treat each re-fetched, `verified` receipt as the proof |
| Unwanted funds movement | `simulate:true` never signs; broadcasts require the org's Turnkey wallet; an operator confirm gate is on by default |
| 24h replay window swallowing a repeated job | watch-mode keys include a **time bucket + cycle number**, so each cadence run is its own piece of work |

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│  Solvency Sentinel (this repo)                                 │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐   │
│  │ aave/     │  │ aave/     │  │ keeperhub/│  │ report.ts │   │
│  │ position  │→ │ health    │→ │ client.ts │→ │ audit run │   │
│  │ (reads)   │  │ (decide)  │  │ (exec)    │  │ report    │   │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘   │
│  sentinel.ts: read → evaluate → preflight → broadcast → verify │
└──────────────────────────────┬────────────────────────────────┘
                               │ HTTPS (Bearer kh_…, Idempotency-Key)
                               ▼
                     KeeperHub Direct Execution API
         /api/execute/contract-call · /transfer · /check-and-execute
                               │
                               ▼
                     Aave V3 Pool contract (EVM)
```

The agent reads the position through KeeperHub itself (`execute_contract_call`
on `Pool.getUserAccountData`), so **every read and every write is observable
through the same execution audit trail**.

## Safe first-write sequence (implemented)

1. `GET /api/chains` → pick a chain where `isEnabled && isTestnet`
2. Read `getUserAccountData(user)` → health factor
3. `decideAction` → healthy / watch / critical / liquidatable (thresholds are config)
4. If acting: `simulate: true` on the repay — abort on any error (`wouldRevert`,
   `insufficient_balance` with `balanceWei/requiredWei/shortfallWei`)
5. Broadcast once with a **derived idempotency key**
6. Poll `GET /api/execute/{id}/status`, honoring `X-Poll-Interval-Hint`
7. Run report written to `docs/runs/` — receipts (hash, chain, verified,
   receiptStatus, block, gasUsed) are the authoritative proof

A `409 idempotency_conflict` is treated as an **answer, not an error**: the
agent polls `originalExecutionId` to learn the outcome of the work it was retrying.

## Quickstart

```bash
npm install
cp .env.example .env        # add KEEPERHUB_API_KEY and SENTINEL_USER
npm run typecheck
npm test                    # 27 tests: idempotency, decision logic, client errors, e2e loop

npm run check    -- --chain 84532 --user 0x…     # read-only health factor
npm run monitor  -- --chain 84532 --user 0x…     # one-shot protect
npm run watch    -- --chain 84532 --user 0x… --interval 60
npm run atom     -- --check-contract 0x… --check-fn balanceOf --value 0 \
                    --action-fn transfer --action-args '["0x…","1000000"]' --simulate
npm run status   -- direct_123                    # poll an execution to terminal
npm run monitor  -- --user 0x… --dry-run          # whole loop locally, no API key

# Open a real Aave V3 position on Ethereum Sepolia entirely through KeeperHub
# (wrap ETH -> WETH, approve the pool, supply WETH, borrow USDC):
node --import tsx/esm scripts/seed-position.ts
```

`monitor` simulates the repay, asks you to type `repay` to confirm, then
broadcasts and verifies. Reports land in `docs/runs/` as JSON + Markdown.
`--dry-run` runs the exact same loop against a local mock (no API key, nothing
broadcast) and marks reports as DRY RUN.

## The atomic path: `check-and-execute`

`POST /api/execute/check-and-execute` reads a value, evaluates a condition, and
conditionally executes — one KeeperHub call, no agent loop in between. Useful as
the off-switch primitive ("if wallet balance < X, top it up") when you want
KeeperHub's backend, not the agent's loop, to own the decision.

## MCP server (KeeperHub surface #1)

Any MCP-capable agent can drive the sentinel directly. Three tools:
`sentinel_check` (read-only health factor), `sentinel_monitor` (full protect
loop, returns the run report), `sentinel_status` (execution + receipts).

```bash
npm run mcp    # stdio MCP server
```

Claude Code / other MCP hosts:

```bash
claude mcp add --transport stdio sentinel -- npm run mcp
```

`sentinel_monitor` supports `dryRun` for zero-risk evaluation; live broadcasts
need `KEEPERHUB_API_KEY` and default to an operator confirm.

## Supported chains

Aave V3 pool addresses are pinned per chain (from `@bgd-labs/aave-address-book`):

| chainId | network | testnet |
| --- | --- | --- |
| 84532 | Base Sepolia | ✅ |
| 11155111 | Ethereum Sepolia | ✅ |
| 8453 | Base | |
| 42161 | Arbitrum One | |
| 137 | Polygon | |
| 1 | Ethereum | |

## Proof of live transactions

Live end-to-end run on **Ethereum Sepolia** (chain 11155111), every write through
the KeeperHub execution API:

| step | action | tx (sepolia.etherscan.io/tx/) |
| --- | --- | --- |
| 1 | wrap 0.04 ETH → WETH (`WETH.deposit`, payable) | `0xd88c9f06bd7ec93d5c8d62603e655efed444289dc08bed5fc85d088c552315e7` (block 11469909) |
| 2 | approve WETH → Aave pool | `0x560a379bfefcbdcd2b10b12d1ee98d697463c6a4785035a7237bd7a746bf8383` |
| 3 | supply 0.02 WETH collateral | `0x8466b1132dd4cf20837f88be36a3057a8c5464f1d46ad76222d8bf42614de17a` |
| 4 | borrow 50 USDC (variable) | `0x6e5ea1541be4ce616bccf4a69c1b522030ba6e746dea5dcf3d8243495ff19ed7`, `0xb7515de81ea544c70b0c407ef1f30ff96facd45d8e955714a5799ea799ed6275` |
| 5 | **sentinel rescue**: HF 1.320 < critical 1.5 → approve USDC → repay 50 USDC | approve `0xae8725b8818e616cb55ff06f7698f601cc3f11717bc0616b0d74c3ad82e50f4b` · repay `0x1c5eae2e1a4c90b54b8573efd78733a1a482b77223128d55e722e2fa5a1f1348` (block 11469993) |
| 6 | post-rescue health factor | **1.320 → 106,623.59**, debt $50 → $0.00 |

Full audit trail: [`docs/runs/sentinel-monitor-4856C803-2026-08-12T01-34-03-644Z.json`](docs/runs/sentinel-monitor-4856C803-2026-08-12T01-34-03-644Z.json).
The repay was KeeperHub-sponsored (`sponsored: true`), simulated first (gas
193,203, `wouldRevert: false`), broadcast with a derived `Idempotency-Key`, and
verified via the status endpoint's on-chain receipt (`receiptStatus success`).
Reproduction steps: `docs/OPS-GUIDE.md`.
