# DoraHacks BUIDL form — paste-ready answers

> Fill these in at https://dorahacks.io/hackathon/agents-onchain/buidl (deadline
> Aug 13, 2026 11:00 local / 10:00 UTC).

## BUIDL (project) name
Solvency Sentinel

## BUIDL logo
`docs/logo.png` (480 × 480 PNG, ~17 KB, well under the 2 MB limit).
Upload as-is; the field recommends 480 × 480.

## Vision (problem this project solves)
DeFi lending positions can be liquidated in a single sharp market move — and
liquidators usually win before a human even notices. Solvency Sentinel is an
autonomous agent that watches an Aave V3 position and, the moment the health
factor crosses a critical threshold, rescues it onchain: it reads the exact
debt, checks the wallet's allowance, auto-approves the pool, and repays — every
write preflighted with KeeperHub's simulate-first flow and every outcome
verified by an on-chain receipt with a full audit trail.

It is not a mockup. On Ethereum Sepolia the agent detected health factor 1.32,
repaid 50 USDC through KeeperHub, and returned the position to health factor
106,623. Transaction it executed via KeeperHub:
https://sepolia.etherscan.io/tx/0x1c5eae2e1a4c90b54b8573efd78733a1a482b77223128d55e722e2fa5a1f1348

## Category
DeFi (falls under DeFi / AI Agents / Autonomous Agents / Onchain on the page's
tag list; DeFi is the best single-select).

## Links

### GitHub / Gitlab / Bitbucket (required)
https://github.com/orjinameh/keeperhub-solvency-sentinel

### Project website (optional)
Leave blank — or use https://github.com/orjinameh/keeperhub-solvency-sentinel

### Demo video (required — YouTube recommended)
`<YouTube link here>` (record per docs/VIDEO.md, upload unlisted, paste the link;
an unlisted YouTube URL renders as an embedded player in the BUIDL profile).

### Social links (at least one required)
- https://github.com/orjinameh
- (optional second) https://x.com/your-handle  ← fill with the real handle
