import type { AccountData } from "./position.ts";

export type RiskLevel = "liquidatable" | "critical" | "watch" | "healthy";

export interface HealthDecision {
  level: RiskLevel;
  shouldAct: boolean;
  reason: string;
  healthFactor: number;
  criticalHf: number;
  targetHf: number;
  debtInBase: number;
  collateralInBase: number;
  liquidationThresholdPct: number;
}

export interface SentinelPolicy {
  criticalHf: number;
  targetHf: number;
}

export function decideAction(account: AccountData, policy: SentinelPolicy): HealthDecision {
  const hf = account.healthFactorNumber;
  const toUsd = (v: bigint) => Number(v) / 1e8;
  const debt = toUsd(account.totalDebtBase);
  const collateral = toUsd(account.totalCollateralBase);
  const ltPct = (Number(account.currentLiquidationThreshold) / 1e4) * 100;

  if (hf <= 0 || debt <= 0n) {
    return {
      level: "healthy",
      shouldAct: false,
      reason: "No outstanding debt — nothing to protect.",
      healthFactor: hf,
      criticalHf: policy.criticalHf,
      targetHf: policy.targetHf,
      debtInBase: debt,
      collateralInBase: collateral,
      liquidationThresholdPct: ltPct,
    };
  }
  if (hf < 1) {
    return {
      level: "liquidatable",
      shouldAct: true,
      reason: `HEALTH FACTOR ${hf.toFixed(3)} is below 1 — position is liquidatable RIGHT NOW.`,
      healthFactor: hf,
      criticalHf: policy.criticalHf,
      targetHf: policy.targetHf,
      debtInBase: debt,
      collateralInBase: collateral,
      liquidationThresholdPct: ltPct,
    };
  }
  if (hf < policy.criticalHf) {
    return {
      level: "critical",
      shouldAct: true,
      reason: `Health factor ${hf.toFixed(3)} dropped below critical threshold ${policy.criticalHf}.`,
      healthFactor: hf,
      criticalHf: policy.criticalHf,
      targetHf: policy.targetHf,
      debtInBase: debt,
      collateralInBase: collateral,
      liquidationThresholdPct: ltPct,
    };
  }
  if (hf < policy.targetHf) {
    return {
      level: "watch",
      shouldAct: false,
      reason: `Health factor ${hf.toFixed(3)} is below target ${policy.targetHf} but above critical — watching.`,
      healthFactor: hf,
      criticalHf: policy.criticalHf,
      targetHf: policy.targetHf,
      debtInBase: debt,
      collateralInBase: collateral,
      liquidationThresholdPct: ltPct,
    };
  }
  return {
    level: "healthy",
    shouldAct: false,
    reason: `Health factor ${hf.toFixed(3)} is above target ${policy.targetHf}.`,
    healthFactor: hf,
    criticalHf: policy.criticalHf,
    targetHf: policy.targetHf,
    debtInBase: debt,
    collateralInBase: collateral,
    liquidationThresholdPct: ltPct,
  };
}

export function formatAccountData(account: AccountData): Record<string, string> {
  return {
    user: account.user,
    chainId: account.chain.chainId,
    chain: account.chain.name,
    healthFactor: account.healthFactorNumber.toFixed(4),
    totalCollateralUsd: `$${(Number(account.totalCollateralBase) / 1e8).toFixed(2)}`,
    totalDebtUsd: `$${(Number(account.totalDebtBase) / 1e8).toFixed(2)}`,
    availableBorrowUsd: `$${(Number(account.availableBorrowsBase) / 1e8).toFixed(2)}`,
    liquidationThreshold: `${((Number(account.currentLiquidationThreshold) / 1e4) * 100).toFixed(1)}%`,
    ltv: `${((Number(account.ltv) / 1e4) * 100).toFixed(1)}%`,
  };
}
