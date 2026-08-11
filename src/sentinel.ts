import { createInterface } from "node:readline";
import { getAaveChain } from "./aave/chains.ts";
import { decideAction, formatAccountData, type SentinelPolicy } from "./aave/health.ts";
import { findBorrows, readAccountData } from "./aave/position.ts";
import { MAX_UINT256, POOL_ABI } from "./aave/abi.ts";
import {
  executeContractCall,
  pollUntilTerminal,
  simulateContractCall,
  type ContractCallRequest,
  type ExecutionStatusResponse,
} from "./keeperhub/client.ts";
import { deriveIdempotencyKey } from "./keeperhub/idempotency.ts";
import type { AaveChain } from "./aave/chains.ts";
import type { AccountData } from "./aave/position.ts";

export interface KeeperHubOps {
  readAccountData(chain: AaveChain, user: string): Promise<AccountData>;
  findBorrows(chain: AaveChain, user: string): Promise<Array<{ asset: string; stableDebt: bigint; variableDebt: bigint }>>;
  simulateContractCall(req: ContractCallRequest): Promise<{ success: boolean; gasEstimate?: string; from?: string }>;
  executeContractCall(req: ContractCallRequest, taskId?: string): Promise<{ executionId: string; status: string; idempotentReplay?: boolean }>;
  pollUntilTerminal(id: string): Promise<ExecutionStatusResponse>;
}

export const realOps: KeeperHubOps = {
  readAccountData,
  findBorrows,
  simulateContractCall,
  executeContractCall,
  pollUntilTerminal,
};

export interface SentinelRunOptions {
  chainId: string;
  user: string;
  policy: SentinelPolicy;
  taskId: string;
  confirm: boolean;
  dryRun?: boolean;
  ops?: KeeperHubOps;
  onLog?: (line: string) => void;
}

export interface SentinelStep {
  name: string;
  ok: boolean;
  detail: string;
  data?: unknown;
}

export interface SentinelRunReport {
  taskId: string;
  chainId: string;
  user: string;
  startedAt: string;
  account: Record<string, string>;
  decision: { level: string; shouldAct: boolean; reason: string };
  steps: SentinelStep[];
  execution?: {
    executionId: string;
    status: string;
    transactionHash?: string;
    transactionLink?: string;
    sponsored?: boolean;
    receipts?: VerifiedReceipt[];
    idempotentReplay?: boolean;
  };
  dryRun?: boolean;
  finishedAt: string;
}

export interface VerifiedReceipt {
  hash: string;
  chainId: number;
  verified: boolean;
  receiptStatus: string;
  blockNumber: number;
  gasUsed: string;
}

function log(opts: SentinelRunOptions, line: string): void {
  if (opts.onLog) opts.onLog(line);
  else console.log(line);
}

export async function runSentinel(opts: SentinelRunOptions): Promise<SentinelRunReport> {
  const ops = opts.ops ?? realOps;
  const chain = getAaveChain(opts.chainId);
  const steps: SentinelStep[] = [];
  const startedAt = new Date().toISOString();
  log(opts, `[sentinel] task=${opts.taskId} chain=${chain.name} (${chain.chainId}) user=${opts.user}${opts.dryRun ? " [DRY RUN]" : ""}`);

  const account = await ops.readAccountData(chain, opts.user);
  steps.push({
    name: "read-position",
    ok: true,
    detail: `HF ${account.healthFactorNumber.toFixed(4)}`,
    data: formatAccountData(account),
  });
  log(opts, `[sentinel] health factor = ${account.healthFactorNumber.toFixed(4)}`);

  const decision = decideAction(account, opts.policy);
  steps.push({
    name: "evaluate",
    ok: true,
    detail: decision.reason,
    data: { level: decision.level, shouldAct: decision.shouldAct },
  });
  log(opts, `[sentinel] decision=${decision.level} act=${decision.shouldAct} — ${decision.reason}`);

  let execution: SentinelRunReport["execution"];
  if (decision.shouldAct) {
    const borrows = await ops.findBorrows(chain, opts.user);
    const debtAsset = borrows[0];
    if (!debtAsset) {
      steps.push({
        name: "find-debt-asset",
        ok: false,
        detail: "No borrows found for user — nothing to repay.",
      });
      log(opts, `[sentinel] WARNING: shouldAct but no borrows found; skipping repay`);
    } else {
      steps.push({
        name: "find-debt-asset",
        ok: true,
        detail: `debt asset ${debtAsset.asset} (variable ${debtAsset.variableDebt}, stable ${debtAsset.stableDebt})`,
      });

      const repayReq: ContractCallRequest = {
        chainId: chain.chainId,
        contractAddress: chain.pool,
        functionName: "repay",
        functionArgs: JSON.stringify([debtAsset.asset, MAX_UINT256, 2, opts.user]),
        abi: POOL_ABI,
      };

      log(opts, `[sentinel] preflighting repay simulation (no broadcast)`);
      const sim = await ops.simulateContractCall(repayReq);
      steps.push({
        name: "simulate",
        ok: sim.success === true,
        detail: `gasEstimate=${sim.gasEstimate} from=${sim.from}`,
        data: sim,
      });
      if (sim.success !== true) {
        throw new Error(`Simulation failed — treating as hard stop (per KeeperHub safe-first-write sequence).`);
      }

      const repayTaskId = `${opts.taskId}|repay`;
      const idempotencyKey = deriveIdempotencyKey({
        taskId: repayTaskId,
        chainId: chain.chainId,
        address: chain.pool,
        amount: "0",
        extras: { fn: "repay", args: JSON.stringify([debtAsset.asset, MAX_UINT256, 2, opts.user]) },
      });
      log(opts, `[sentinel] idempotency-key=${idempotencyKey.slice(0, 16)}…`);

      if (opts.confirm) {
        const ok = await confirmRepay(debtAsset.asset, decision);
        if (!ok) {
          steps.push({ name: "confirm", ok: false, detail: "Repay declined by operator." });
          log(opts, `[sentinel] operator declined — skipping broadcast`);
        } else {
          execution = await broadcastAndWait(repayReq, repayTaskId, steps, opts);
        }
      } else {
        execution = await broadcastAndWait(repayReq, repayTaskId, steps, opts);
      }
    }
  }

  const report: SentinelRunReport = {
    taskId: opts.taskId,
    chainId: opts.chainId,
    user: opts.user,
    startedAt,
    account: formatAccountData(account),
    decision: { level: decision.level, shouldAct: decision.shouldAct, reason: decision.reason },
    steps,
    execution,
    dryRun: opts.dryRun,
    finishedAt: new Date().toISOString(),
  };

  if (execution?.transactionLink) {
    log(opts, `[sentinel] TX CONFIRMED: ${execution.transactionLink}`);
  } else if (execution) {
    log(opts, `[sentinel] execution completed: ${execution.executionId}`);
  }
  return report;
}

async function broadcastAndWait(
  repayReq: ContractCallRequest,
  taskId: string,
  steps: SentinelStep[],
  opts: SentinelRunOptions
): Promise<SentinelRunReport["execution"]> {
  const ops = opts.ops ?? realOps;
  log(opts, `[sentinel] broadcasting repay (idempotency-key bound to ${taskId})`);
  const result = await ops.executeContractCall(repayReq, taskId);
  steps.push({
    name: "execute",
    ok: result.status === "completed",
    detail: `executionId=${result.executionId} status=${result.status}${result.idempotentReplay ? " (replay)" : ""}`,
    data: result,
  });
  log(opts, `[sentinel] executionId=${result.executionId} status=${result.status} idempotentReplay=${result.idempotentReplay ?? false}`);

  let final: ExecutionStatusResponse = { ...result, status: result.status as ExecutionStatusResponse["status"] };
  final = await ops.pollUntilTerminal(result.executionId);
  steps.push({
    name: "poll",
    ok: final.status === "completed",
    detail: `final status=${final.status} (receipts from status endpoint)`,
    data: final,
  });
  log(opts, `[sentinel] final status=${final.status}`);

  const receipts = final.receipts?.map((r) => ({
    hash: r.hash,
    chainId: r.chainId,
    verified: r.verified,
    receiptStatus: r.receiptStatus,
    blockNumber: r.blockNumber,
    gasUsed: r.gasUsed,
  }));
  const execution = {
    executionId: final.executionId,
    status: final.status,
    transactionHash: final.transactionHash,
    transactionLink: final.transactionLink,
    sponsored: final.sponsored,
    receipts,
    idempotentReplay: result.idempotentReplay,
  };
  steps.push({
    name: "verify",
    ok: final.status === "completed" && (final.receipts?.every((r) => r.verified && r.receiptStatus === "success") ?? false),
    detail: receipts ? `verified=${receipts.length} receipt(s)` : "no receipts",
    data: receipts,
  });
  return execution;
}

function confirmRepay(asset: string, decision: { reason: string }): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(
      `[sentinel] About to broadcast repay on asset ${asset} — reason: ${decision.reason}\n[sentinel] Type "repay" to proceed: `,
      (answer: string) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === "repay");
      }
    );
  });
}
