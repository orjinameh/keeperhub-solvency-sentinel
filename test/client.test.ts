import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  executeTransfer,
  getExecutionStatus,
  pollUntilTerminal,
  simulateContractCall,
  KeeperHubError,
  SimulateRevertError,
  WalletNotConfiguredError,
} from "../src/keeperhub/client.ts";

const originalFetch = globalThis.fetch;
let calls: Array<{ url: string; init: RequestInit }> = [];

function mockFetch(handler: (url: string, init: RequestInit) => { status: number; body: unknown; headers?: Record<string, string> }): void {
  (globalThis as { fetch: typeof fetch }).fetch = async (input: any, init: any) => {
    const url = typeof input === "string" ? input : String(input);
    calls.push({ url, init });
    const res = handler(url, init);
    const h = new Headers({ "content-type": "application/json", ...(res.headers ?? {}) });
    return new Response(JSON.stringify(res.body), { status: res.status, headers: h });
  };
}

afterEach(() => {
  (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
  calls = [];
  delete process.env.KEEPERHUB_API_KEY;
});

test("executeTransfer sends auth + idempotency headers and parses 202", async () => {
  process.env.KEEPERHUB_API_KEY = "kh_test";
  mockFetch((url, init) => {
    assert.equal(url, "https://app.keeperhub.com/api/execute/transfer");
    const headers = new Headers(init.headers);
    assert.equal(headers.get("Authorization"), "Bearer kh_test");
    assert.ok(headers.get("Idempotency-Key"));
    assert.match(headers.get("Idempotency-Key")!, /^[0-9a-f]{64}$/);
    return { status: 202, body: { executionId: "direct_1", status: "completed", transactionHash: "0xabc" } };
  });
  const res = await executeTransfer(
    { chainId: "84532", recipientAddress: "0x742d35cc6634c0532925a3b844bc454e4438f44e", amount: "0.01" },
    "test-transfer-1"
  );
  assert.equal(res.executionId, "direct_1");
  assert.equal(res.status, "completed");
});

test("simulate sends simulate:true in the body", async () => {
  process.env.KEEPERHUB_API_KEY = "kh_test";
  let bodySeen: any;
  mockFetch((_url, init) => {
    bodySeen = JSON.parse(String(init.body));
    return { status: 200, body: { success: true, status: "simulated", wouldRevert: false, gasEstimate: "65000" } };
  });
  const res = await simulateContractCall({
    chainId: "84532",
    contractAddress: "0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27",
    functionName: "repay",
  });
  assert.equal(bodySeen.simulate, true);
  assert.equal(res.wouldRevert, false);
});

test("422 WALLET_NOT_CONFIGURED maps to WalletNotConfiguredError", async () => {
  process.env.KEEPERHUB_API_KEY = "kh_test";
  mockFetch(() => ({
    status: 422,
    body: { error: "Wallet not configured", code: "WALLET_NOT_CONFIGURED" },
  }));
  await assert.rejects(
    executeTransfer({ chainId: "84532", recipientAddress: "0x742d35cc6634c0532925a3b844bc454e4438f44e", amount: "1" }, "t"),
    (e: Error) => e instanceof WalletNotConfiguredError
  );
});

test("400 with wouldRevert maps to SimulateRevertError with insufficient_balance detail", async () => {
  process.env.KEEPERHUB_API_KEY = "kh_test";
  mockFetch(() => ({
    status: 400,
    body: {
      success: false,
      status: "simulated",
      wouldRevert: true,
      revertReason: "Insufficient ETH balance. Have: 0.25, Need: 1.0.",
      code: "insufficient_balance",
      balanceWei: "250000000000000000",
      requiredWei: "1000000000000000000",
      shortfallWei: "750000000000000000",
    },
  }));
  await assert.rejects(
    simulateContractCall({ chainId: "84532", contractAddress: "0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27", functionName: "repay" }),
    (e: Error) => e instanceof SimulateRevertError && e.status === 400
  );
});

test("403 spending cap surfaces as KeeperHubError with daily-cap message", async () => {
  process.env.KEEPERHUB_API_KEY = "kh_test";
  mockFetch(() => ({ status: 403, body: { error: "Daily spending cap exceeded" } }));
  await assert.rejects(
    executeTransfer({ chainId: "84532", recipientAddress: "0x742d35cc6634c0532925a3b844bc454e4438f44e", amount: "1" }, "t"),
    (e: Error) => e instanceof KeeperHubError && e.status === 403
  );
});

test("getExecutionStatus honors X-Poll-Interval-Hint header", async () => {
  process.env.KEEPERHUB_API_KEY = "kh_test";
  mockFetch(() => ({ status: 200, body: { executionId: "direct_9", status: "running" }, headers: { "X-Poll-Interval-Hint": "3" } }));
  const res = await getExecutionStatus("direct_9");
  assert.equal(res.pollIntervalHintSeconds, 3);
  assert.equal(res.status, "running");
});

test("pollUntilTerminal returns as soon as a terminal status appears", async () => {
  process.env.KEEPERHUB_API_KEY = "kh_test";
  let poll = 0;
  mockFetch(() => {
    poll++;
    return {
      status: 200,
      body: {
        executionId: "direct_10",
        status: poll === 1 ? "running" : "completed",
        transactionHash: "0xbeef",
        receipts: [{ hash: "0xbeef", chainId: 84532, verified: true, receiptStatus: "success", blockNumber: 1, gasUsed: "21000", verifiedAt: "x" }],
      },
      headers: { "X-Poll-Interval-Hint": "0" },
    };
  });
  const res = await pollUntilTerminal("direct_10", { maxSeconds: 10 });
  assert.equal(res.status, "completed");
  assert.equal(res.receipts?.[0]?.verified, true);
});
