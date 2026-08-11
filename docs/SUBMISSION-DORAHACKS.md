# KeeperHub Agents Onchain — Submission (DoraHacks BUIDL)

> Deadline: **Aug 13, 2026, 12:00 UTC** (dorahacks.io/hackathon/agents-onchain/detail).
> Required: GitHub link · demo video · **link to a real transaction the agent executed via KeeperHub**.

## Title
Solvency Sentinel

## Tagline
An agent that watches a DeFi lending position and proves every rescue transaction it lands — simulate-first, idempotent, receipt-verified through KeeperHub.

## Description (paste into the BUIDL form)

Solvency Sentinel is an autonomous agent that protects an Aave V3 lending
position. It reads the position's health factor through KeeperHub, decides
whether to act, and when it does, it follows KeeperHub's **safe first-write
sequence end to end**: simulate → broadcast with a derived idempotency key →
poll until a verified on-chain receipt — then writes an audit-trail run report.

The brief asked for an agent whose decisions actually settle on-chain, **with no
failed transactions, no gas surprises, no missing observability, no absent
guarantees**. That is the entire thesis of this build:

- **No failed transactions.** Every write is preflighted with `simulate: true`
  (`provider.estimateGas` + `provider.call`). Reverts, bad ABIs, allowance
  mismatches and funding shortfalls surface as typed errors with decoded reasons
  and machine-readable codes (`insufficient_balance` carries `balanceWei`,
  `requiredWei`, `shortfallWei`). A simulation that would revert is a hard stop —
  nothing is ever signed blind.
- **No double-execution.** Broadcasts carry an `Idempotency-Key` derived as the
  SHA-256 of a canonical `taskId|chainId|address|amount|effect-fields` string, so
  a retry after a crash or timeout returns the *same* execution instead of
  sending a second transaction. A `409 idempotency_conflict` is treated as an
  answer, not an error: the agent polls `originalExecutionId` to learn the real
  outcome. Watch-mode keys include a time bucket + cycle number so the 24-hour
  replay window can never swallow a repeated job.
- **No MEV surprises.** KeeperHub controls gas (gas limit multiplier, gas
  management, optional sponsorship via relayer/Safe paths); the agent verifies
  the `sponsored` flag and never assumes the EOA nonce moved.
- **No missing observability.** Every read and write goes through KeeperHub's
  execution audit trail. After broadcast the agent polls
  `GET /api/execute/{id}/status` (honoring `X-Poll-Interval-Hint`) and treats
  the status response's **receipts** — each independently re-fetched from the
  chain, `verified` + `receiptStatus` — as the authoritative proof. A JSON +
  Markdown run report is written per cycle to `docs/runs/`.

The agent is network- and protocol-shaped: Aave V3 pool addresses are pinned per
chain (Base Sepolia, Ethereum Sepolia, Base, Arbitrum, Polygon, Ethereum) so a
single codebase protects real testnet and mainnet positions. It ships four
surfaces: `check` (read-only health factor), `monitor` (one-shot protect),
`watch` (cadence loop), and `atom` (KeeperHub's atomic `check-and-execute`
primitive — read a value, evaluate a condition, conditionally execute, all in one
call). A `--dry-run` mode runs the whole loop locally for testing; real
broadcasts require the org wallet integration and an operator confirm by default.

**GitHub:** <to be filled>
**Demo video:** <to be filled>
**Real transaction executed via KeeperHub:** <to be filled — from the latest docs/runs report>

## Where to find the proof
Every broadcast writes `executionId`, `transactionHash`, explorer
`transactionLink` and the verified receipts into `docs/runs/*.json` and
`*.md`. The latest report is the submission's on-chain evidence.
