import { test } from "node:test";
import assert from "node:assert/strict";
import { decideAction, type SentinelPolicy } from "../src/aave/health.ts";
import type { AccountData } from "../src/aave/position.ts";
import { getAaveChain } from "../src/aave/chains.ts";

const policy: SentinelPolicy = { criticalHf: 1.05, targetHf: 1.5 };

function account(healthFactor: number, opts?: { debt?: bigint }): AccountData {
  const chain = getAaveChain("84532");
  return {
    user: "0xabc",
    chain,
    totalCollateralBase: 100000000000n, // $1000
    totalDebtBase: opts?.debt ?? 50000000000n, // $500
    availableBorrowsBase: 0n,
    currentLiquidationThreshold: 8000n, // 80%
    ltv: 7500n,
    healthFactor: BigInt(Math.round(healthFactor * 1e18)),
    healthFactorNumber: healthFactor,
  };
}

test("no debt is always healthy and inert", () => {
  const d = decideAction(account(0, { debt: 0n }), policy);
  assert.equal(d.level, "healthy");
  assert.equal(d.shouldAct, false);
});

test("hf below 1 is liquidatable and acts", () => {
  const d = decideAction(account(0.9), policy);
  assert.equal(d.level, "liquidatable");
  assert.equal(d.shouldAct, true);
  assert.match(d.reason, /liquidat/i);
});

test("hf below critical threshold acts", () => {
  const d = decideAction(account(1.02), policy);
  assert.equal(d.level, "critical");
  assert.equal(d.shouldAct, true);
});

test("hf between critical and target is watch, no act", () => {
  const d = decideAction(account(1.3), policy);
  assert.equal(d.level, "watch");
  assert.equal(d.shouldAct, false);
});

test("hf above target is healthy", () => {
  const d = decideAction(account(1.8), policy);
  assert.equal(d.level, "healthy");
  assert.equal(d.shouldAct, false);
});

test("strictly below the critical threshold acts; at/above it does not", () => {
  assert.equal(decideAction(account(1.04), policy).shouldAct, true);
  assert.equal(decideAction(account(1.05), policy).shouldAct, false);
  assert.equal(decideAction(account(1.06), policy).shouldAct, false);
});
