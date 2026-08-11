import { getConfig, requireApiKey } from "../config.ts";
import { deriveIdempotencyKey } from "./idempotency.ts";

export class KeeperHubError extends Error {
  status: number;
  code?: string;
  retryable?: boolean;
  originalExecutionId?: string | null;
  body: unknown;
  constructor(status: number, message: string, body: unknown, opts?: { code?: string; retryable?: boolean; originalExecutionId?: string | null }) {
    super(message);
    this.name = "KeeperHubError";
    this.status = status;
    this.body = body;
    this.code = opts?.code;
    this.retryable = opts?.retryable;
    this.originalExecutionId = opts?.originalExecutionId;
  }
}

export class WalletNotConfiguredError extends KeeperHubError {}
export class SimulateRevertError extends KeeperHubError {
  revertReason?: string;
  code2?: string;
  balanceWei?: string;
  requiredWei?: string;
  shortfallWei?: string;
  constructor(status: number, message: string, body: Record<string, unknown>) {
    super(status, message, body, { code: body.code as string });
    this.name = "SimulateRevertError";
    this.revertReason = body.revertReason as string;
    this.code2 = body.code as string;
    this.balanceWei = body.balanceWei as string;
    this.requiredWei = body.requiredWei as string;
    this.shortfallWei = body.shortfallWei as string;
  }
}

export type ExecuteStatus = "pending" | "running" | "completed" | "failed";

export interface ChainInfo {
  chainId: number;
  name: string;
  isTestnet: boolean;
  isEnabled: boolean;
  nativeSymbol?: string;
}

export interface TransferRequest {
  chainId: string | number;
  recipientAddress: string;
  amount: string;
  tokenAddress?: string;
  tokenConfig?: string;
  gasLimitMultiplier?: string;
}

export interface ContractCallRequest {
  chainId: string | number;
  contractAddress: string;
  functionName: string;
  functionArgs?: string;
  abi?: unknown;
  value?: string;
  gasLimitMultiplier?: string;
}

export interface CheckAndExecuteRequest {
  contractAddress: string;
  chainId: string | number;
  functionName: string;
  functionArgs?: string;
  abi?: unknown;
  condition: { operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte"; value: string };
  action: {
    contractAddress: string;
    functionName: string;
    functionArgs?: string;
    abi?: unknown;
    gasLimitMultiplier?: string;
  };
}

export interface ExecutionResult {
  executionId: string;
  status: ExecuteStatus;
  transactionHash?: string;
  transactionLink?: string;
  idempotentReplay?: boolean;
  [k: string]: unknown;
}

export interface SimulateResult {
  success: boolean;
  status: string;
  from?: string;
  to?: string;
  value?: string;
  gasEstimate?: string;
  simulatedReturnValue?: unknown;
  wouldRevert?: boolean;
  [k: string]: unknown;
}

export interface ExecutionStatusResponse {
  executionId: string;
  status: ExecuteStatus;
  type?: string;
  transactionHash?: string;
  transactionLink?: string;
  sponsored?: boolean;
  pollIntervalHintSeconds?: number;
  receipts?: Array<{
    hash: string;
    chainId: number;
    verified: boolean;
    receiptStatus: string;
    blockNumber: number;
    gasUsed: string;
    verifiedAt: string;
  }>;
  gasUsedWei?: string;
  result?: unknown;
  error?: string | null;
  createdAt?: string;
  completedAt?: string;
  [k: string]: unknown;
}

async function request(
  path: string,
  init: { method?: string; body?: unknown; idempotencyKey?: string; timeoutMs?: number }
): Promise<{ status: number; headers: Headers; body: any }> {
  const cfg = getConfig();
  const apiKey = requireApiKey(cfg);
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${apiKey}`);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  if (init.idempotencyKey) headers.set("Idempotency-Key", init.idempotencyKey);

  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(init.timeoutMs ?? 60_000),
  });

  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, headers: res.headers, body: parsed };
}

function throwFor(status: number, body: any, path: string): never {
  const message =
    typeof body === "object" && body !== null && typeof body.error === "string"
      ? body.error
      : `HTTP ${status} from ${path}`;
  if (status === 422 && body?.code === "WALLET_NOT_CONFIGURED") {
    throw new WalletNotConfiguredError(status, message, body);
  }
  if (status === 400 && body?.wouldRevert === true) {
    throw new SimulateRevertError(status, message, body);
  }
  throw new KeeperHubError(status, message, body, {
    code: body?.code,
    retryable: body?.retryable,
    originalExecutionId: body?.originalExecutionId,
  });
}

export async function getChains(): Promise<ChainInfo[]> {
  const { status, body } = await request("/api/chains", {});
  if (status !== 200) throwFor(status, body, "/api/chains");
  const chains: ChainInfo[] = Array.isArray(body) ? body : body?.chains ?? body?.data ?? [];
  return chains;
}

export async function simulateTransfer(req: TransferRequest): Promise<SimulateResult> {
  return simulate("/api/execute/transfer", { ...req, simulate: true });
}

export async function executeTransfer(req: TransferRequest, taskId: string): Promise<ExecutionResult> {
  const key = deriveIdempotencyKey({
    taskId,
    chainId: String(req.chainId),
    address: req.recipientAddress,
    amount: req.amount,
    extras: { token: req.tokenAddress ?? "" },
  });
  return broadcast("/api/execute/transfer", req, key);
}

export async function simulateContractCall(req: ContractCallRequest): Promise<SimulateResult> {
  return simulate("/api/execute/contract-call", { ...req, simulate: true });
}

export async function executeContractCall(req: ContractCallRequest, taskId?: string): Promise<ExecutionResult> {
  if (!taskId) {
    return broadcast("/api/execute/contract-call", req, undefined);
  }
  const key = deriveIdempotencyKey({
    taskId,
    chainId: String(req.chainId),
    address: req.contractAddress,
    amount: req.value ?? "0",
    extras: { fn: req.functionName, args: req.functionArgs ?? "" },
  });
  return broadcast("/api/execute/contract-call", req, key);
}

export async function checkAndExecute(
  req: CheckAndExecuteRequest,
  opts: { simulate?: boolean; taskId?: string } = {}
): Promise<ExecutionResult | SimulateResult> {
  const body = { ...req, ...(opts.simulate ? { simulate: true } : {}) };
  if (opts.simulate) {
    return simulate("/api/execute/check-and-execute", body);
  }
  const key = deriveIdempotencyKey({
    taskId: opts.taskId ?? "check-and-execute",
    chainId: String(req.chainId),
    address: req.action.contractAddress,
    amount: "0",
    extras: { checkFn: req.functionName, actionFn: req.action.functionName },
  });
  return broadcast("/api/execute/check-and-execute", body, key);
}

async function simulate(path: string, body: unknown): Promise<SimulateResult> {
  const { status, body: res } = await request(path, { body, timeoutMs: 90_000 });
  if (status !== 200) throwFor(status, res, path);
  return res as SimulateResult;
}

async function broadcast(path: string, body: unknown, idempotencyKey: string | undefined): Promise<ExecutionResult> {
  const { status, body: res } = await request(path, {
    body,
    idempotencyKey,
    timeoutMs: 120_000,
  });
  if (status !== 202 && status !== 200) throwFor(status, res, path);
  return res as ExecutionResult;
}

export async function getExecutionStatus(executionId: string): Promise<ExecutionStatusResponse> {
  const { status, headers, body } = await request(`/api/execute/${executionId}/status`, {
    timeoutMs: 30_000,
  });
  if (status !== 200) throwFor(status, body, `/api/execute/${executionId}/status`);
  const hintRaw = headers.get("X-Poll-Interval-Hint");
  return { ...(body ?? {}), pollIntervalHintSeconds: hintRaw ? Number(hintRaw) : undefined };
}

export async function pollUntilTerminal(
  executionId: string,
  opts: { maxSeconds?: number } = {}
): Promise<ExecutionStatusResponse> {
  const deadline = Date.now() + (opts.maxSeconds ?? 300) * 1000;
  for (;;) {
    const res = await getExecutionStatus(executionId);
    if (res.status === "completed" || res.status === "failed") return res;
    if (Date.now() >= deadline) {
      throw new KeeperHubError(0, `Timed out polling execution ${executionId}`, null);
    }
    const hint = res.pollIntervalHintSeconds ?? 2;
    const sleepMs = Math.min(Math.max(hint, 1), 15) * 1000;
    await new Promise((r) => setTimeout(r, sleepMs));
  }
}
