# KeeperHub Onboarding Teardown — where we got stuck and the fixes

> Submission for the **Best Onboarding UX Improvement** bounty: a clear teardown
> of where we got stuck while shipping a real KeeperHub execution, with proposed
> fixes. These are all bugs/quirks we hit live on Ethereum Sepolia while building
> Solvency Sentinel — every one cost real debugging time, and every one is
> reproducible from a clean machine in minutes.

## 0. TL;DR — the five traps

1. `contract-call` `value` is in **ETH units**, not wei.
2. The **`mint` ambiguity**: Aave Sepolia mock assets expose
   `mint(address,uint256)` AND `mint(uint256)` — KeeperHub's encoder rejects the
   overload, so you can't fund test assets by minting.
3. **`Pool.getUserReserveData` / `getUserConfiguration` are not resolvable**
   through contract-call (KeeperHub's function store), but the Aave **data
   provider** equivalent works.
4. Some Aave Sepolia reserves (WETH, AAVE, WBTC, USDT) **cannot be borrowed**
   (Error 30 `BORROWING_NOT_ENABLED`, Error 36, Panic 17) — pick the debt asset
   up front.
5. **Idempotency replay window is 24 hours**: re-running a command with the same
   task-id + address + amount returns the *old* execution (`idempotentReplay:
   true`) instead of sending a new transaction — your position is not rescued
   even though the API says "completed".

All five are absent from the docs pages we could find; fixing #5 in particular
required reverse-engineering from a live failure. Details, repro, and proposed
fixes below.

## 1. `value` is in ETH units, not wei

**Symptom.** Calling `WETH.deposit` with `value: "40000000000000000"` (0.04 ETH
in wei) reverts in simulation with:

```
Insufficient ETH balance. Have: 0.05, Need: 40000000000000000.0
```

The wallet holds 0.05 ETH; the API interpreted 4e16 as **4e16 ETH**.

**Repro.**
```bash
curl -s -X POST https://api.keeperhub.com/api/execute/contract-call \
  -H "Authorization: Bearer $KH_KEY" -H "Content-Type: application/json" \
  -d '{"chainId":"11155111","contractAddress":"0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c",
       "functionName":"deposit","functionArgs":"[]","value":"40000000000000000","simulate":true}'
```

**Root cause.** The request `value` is denominated in ETH (decimal string), but
the simulated response's `value` is in wei — inconsistent units across the same
field, never documented.

**Fix.** Pass `value: "0.04"`. Response fields (`balanceWei`, `requiredWei`,
`shortfallWei`) are wei — keep them as-is.

## 2. Ambiguous `mint` on Aave Sepolia mocks

**Symptom.** `functionName: "mint"` on a USDC mock fails to encode: the contract
has both `mint(uint256)` and `mint(address,uint256)`, and the encoder can't
pick an overload from function name alone.

**Repro.**
```bash
# on USDC 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8 (Sepolia):
curl ... -d '{"functionName":"mint","functionArgs":"[\"50000000\"]",...}'
```

**Fix options.**
- Encode overloads explicitly: allow `functionSignature` (full ABI string) in
  the request so the encoder doesn't guess.
- Or surface a structured "ambiguous overload" error naming the candidates.

**Workaround used.** We stopped relying on minting: the sentinel repays with the
wallet's own borrowed balance.

## 3. `Pool.getUserReserveData` missing from the function store

**Symptom.** `contract-call` on `Pool.getUserReserveData` (and
`getUserConfiguration`) returns "Function not found in ABI" — even with a full
`abi` provided — but `Pool.getReservesList`, `getUserAccountData`,
`getReserveData`, `borrow`, `supply`, `repay` all resolve fine.

**Repro.**
```bash
# Pool 0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951 — fails:
curl ... -d '{"functionName":"getUserReserveData","functionArgs":"[\"0x94a9...\",\"0x4856...\"]",...}'
# Data provider 0x3e9708d80f7B3e43118013075F7e95CE3AB31F31 — works:
curl ... -d '{"contractAddress":"0x3e9708d80f7B3e43118013075F7e95CE3AB31F31",
              "functionName":"getUserReserveData",...}'
```

**Root cause.** Function resolution uses KeeperHub's own ABI store and mostly
ignores the caller-supplied `abi` (which is the confusing part — the field
exists but isn't authoritative).

**Fix options.** Either (a) make the provided `abi` authoritative for function
resolution, or (b) document that resolution uses the internal store and point
builders to the data-provider aliases.

**Workaround used.** We read the debt asset via the Aave **data provider**
(`getUserReserveData`), which returns a named JSON object with
`currentVariableDebt` / `currentStableDebt`.

## 4. Borrowability varies per Sepolia reserve

**Symptom.** `borrow(WETH, ...)` reverts `Error(30)` (`BORROWING_NOT_ENABLED`);
`borrow(WBTC)` → `Error(36)`; `borrow(USDT)` → `Panic(17)` (overflow). Only
DAI / LINK / USDC / EURS / GHO borrow cleanly on Sepolia Aave V3.

**Repro.** See `scripts/probe-reserves.ts` (iterates the 9 reserves and attempts
a 1-wei borrow simulation on each).

**Fix options.** Expose a borrowability flag (e.g. from
`ReserveConfigurationData.borrowingEnabled`) in a docs table, and/or return a
decoded Aave error enum on the borrow simulation response instead of a bare
`Error(30)`.

## 5. The 24-hour idempotency replay window (the expensive one)

**Symptom.** We ran the monitor a second time to rescue a freshly re-borrowed
position. Output:

```
[sentinel] executionId=cdb3k7ptx9vuremz2msum status=completed idempotentReplay=true
[sentinel] TX CONFIRMED: https://sepolia.etherscan.io/tx/0x1c5eae...1348
```

but the health factor stayed at **1.32** — the debt was never repaid. The
`Idempotency-Key` we sent (sha256 of `task|chain|address|amount|effect`) was
identical to the earlier successful run, so KeeperHub returned that *old*
execution. The API says "completed"; nothing happened on-chain.

**Root cause.** The 24-hour replay window is not mentioned anywhere in the
docs we could find, so builders assume a deterministic key gives them exactly-once
forever. It gives exactly-once **within the window** — and silently-replays
after that.

**Repro.**
```bash
# run 1 (any contract-call)
curl ... -H "Idempotency-Key: $(sha256sum <<< 'monitor|11155111|0xPool|0|repay|...')" -d '{...repay 50 USDC...}'
# run 2, same key, 10 minutes later -> idempotentReplay: true, old execution, no new tx
```

**Fix options.**
- Document the window prominently next to `Idempotency-Key`.
- Include `createdAt` (or a nonce) of the *returned* execution in the replay
  response so clients can detect staleness, e.g. `"replayedExecutionCreatedAt"`.
- Consider a `dedupe-window` request param (seconds) so callers opt into
  shorter windows.

**Client-side defense (shipped in Solvency Sentinel).** (a) scope every
idempotency key per run — a fresh `runId` per invocation is folded into the key,
so each run lands a new execution while in-process retries still dedupe; (b)
after every broadcast, re-read the on-chain position and refuse to report
success (`verify-position`) unless the health factor actually recovered. A
stale replay now prints *"position NOT rescued"* instead of "TX CONFIRMED".

---

## Verify against this repo

```bash
git clone https://github.com/orjinameh/keeperhub-solvency-sentinel
npm install && npm test          # 29 tests
node --import tsx/esm scripts/probe-reserves.ts   # #4
# #5: run the monitor twice within 24h against the same position — the second
# run lands a fresh execution and reports RESCUED only on a real HF recovery.
```

All five fixes were learned the hard way on a live rescue; the ones in #5 were
the difference between a "working demo" and an agent that silently lied about
rescuing a position.
