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

> Populated during the demo: each broadcast step writes `executionId`,
> `transactionHash`, explorer `transactionLink`, and the verified receipts into
> `docs/runs/`. See the latest run report.
