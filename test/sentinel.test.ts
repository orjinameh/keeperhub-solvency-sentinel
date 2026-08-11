import { test } from "node:test";
import assert from "node:assert/strict";
import { runSentinel } from "../src/sentinel.ts";
import { dryRunOps } from "../src/keeperhub/mock.ts";

test("full loop (dry-run): critical HF triggers preflight -> broadcast -> verified receipts", async () => {
  const report = await runSentinel({
    chainId: "84532",
    user: "0x1234567890abcdef1234567890abcdef12345678",
    policy: { criticalHf: 1.05, targetHf: 1.5 },
    taskId: "sentinel-e2e-test",
    confirm: false,
    dryRun: true,
    ops: dryRunOps({ healthFactor: 1.02 }),
  });

  assert.equal(report.decision.shouldAct, true);
  assert.equal(report.decision.level, "critical");
  const names = report.steps.map((s) => s.name);
  assert.deepEqual(
    names.filter((n) => ["read-position", "evaluate", "find-debt-asset", "simulate", "execute", "verify"].includes(n)),
    ["read-position", "evaluate", "find-debt-asset", "simulate", "execute", "verify"]
  );
  assert.ok(report.execution);
  assert.equal(report.execution.status, "completed");
  assert.equal(report.execution.receipts?.[0]?.verified, true);
  assert.equal(report.dryRun, true);
});

test("full loop (dry-run): healthy HF never broadcasts", async () => {
  const report = await runSentinel({
    chainId: "84532",
    user: "0x1234567890abcdef1234567890abcdef12345678",
    policy: { criticalHf: 1.05, targetHf: 1.5 },
    taskId: "sentinel-e2e-healthy",
    confirm: false,
    dryRun: true,
    ops: dryRunOps({ healthFactor: 2.1 }),
  });
  assert.equal(report.decision.shouldAct, false);
  assert.equal(report.execution, undefined);
  assert.equal(report.steps.some((s) => s.name === "simulate"), false);
});

test("full loop (dry-run): liquidatable HF acts even though below 1", async () => {
  const report = await runSentinel({
    chainId: "84532",
    user: "0x1234567890abcdef1234567890abcdef12345678",
    policy: { criticalHf: 1.05, targetHf: 1.5 },
    taskId: "sentinel-e2e-liq",
    confirm: false,
    dryRun: true,
    ops: dryRunOps({ healthFactor: 0.88 }),
  });
  assert.equal(report.decision.level, "liquidatable");
  assert.equal(report.decision.shouldAct, true);
  assert.ok(report.execution);
});
