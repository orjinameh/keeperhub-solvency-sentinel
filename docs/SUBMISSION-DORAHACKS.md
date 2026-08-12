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
- **No double-execution, no ghost rescues.** Broadcasts carry an
  `Idempotency-Key` derived as the SHA-256 of a canonical
  `taskId|runId|chainId|address|amount|effect-fields` string. The `runId` is
  unique per invocation, so a fresh run always lands a fresh execution — a stale
  replay inside KeeperHub's 24-hour replay window can never swallow a repeated
  job — while in-process retries reuse the same key and return the *same*
  execution instead of sending a second transaction. Every broadcast is followed
  by a `verify-position` post-check that re-reads the health factor on-chain:
  if it is still below the critical threshold the run is reported as **NOT
  rescued**. The agent never prints "TX CONFIRMED" for a replay that moved
  nothing.
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

**GitHub:** https://github.com/orjinameh/keeperhub-solvency-sentinel
**Demo video:** <to be filled>
**Real transaction executed via KeeperHub:** 
https://sepolia.etherscan.io/tx/0x1c5eae2e1a4c90b54b8573efd78733a1a482b77223128d55e722e2fa5a1f1348

> Live end-to-end run (Ethereum Sepolia, chain 11155111), all through the
> KeeperHub execution API — full audit trail in
> [`docs/runs/sentinel-monitor-4856C803-2026-08-12T01-34-03-644Z.json`](../docs/runs/sentinel-monitor-4856C803-2026-08-12T01-34-03-644Z.json):
>
> 1. Position seeded via KeeperHub: wrap 0.04 ETH → WETH
>    (`0xd88c9f06bd7ec93d5c8d62603e655efed444289dc08bed5fc85d088c552315e7`, block 11469909),
>    approve the Aave pool (`0x560a379bfefcbdcd2b10b12d1ee98d697463c6a4785035a7237bd7a746bf8383`),
>    supply 0.02 WETH (`0x8466b1132dd4cf20837f88be36a3057a8c5464f1d46ad76222d8bf42614de17a`),
>    borrow 50 USDC (`0x6e5ea1541be4ce616bccf4a69c1b522030ba6e746dea5dcf3d8243495ff19ed7`,
>    `0xb7515de81ea544c70b0c407ef1f30ff96facd45d8e955714a5799ea799ed6275`).
> 2. Sentinel `monitor` cycle reads the position: health factor **1.320**, debt
>    **$50** → decision `critical`, act.
> 3. Finds the debt asset (USDC) via the Aave data provider, checks the wallet's
>    balance (50.000000 USDC) and caps the repayment at the available balance.
> 4. Checks allowance (0) → simulates and broadcasts `approve` to the pool
>    (`0xae8725b8818e616cb55ff06f7698f601cc3f11717bc0616b0d74c3ad82e50f4b`, block 11469992).
> 5. Preflights the repay (gas 193,203, `wouldRevert: false`), then broadcasts
>    `repay(address,uint256,uint256,address)` with an idempotency key
>    (`executionId cdb3k7ptx9vuremz2msum`, sponsored by KeeperHub).
> 6. Receipt **verified on-chain**: `0x1c5eae2e1a4c90b54b8573efd78733a1a482b77223128d55e722e2fa5a1f1348`,
>    block 11469993, `receiptStatus success`, gas used 205,412.
> 7. Post-rescue check: health factor **106,623.59**, debt **$0.00**.

## Where to find the proof
Every broadcast writes `executionId`, `transactionHash`, explorer
`transactionLink` and the verified receipts into `docs/runs/*.json` and
`*.md`. The latest report is the submission's on-chain evidence.
