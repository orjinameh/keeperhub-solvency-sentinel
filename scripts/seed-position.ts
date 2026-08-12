import { getConfig } from "../src/config.ts";
import { getAaveChain } from "../src/aave/chains.ts";
import { ERC20_ABI, MAX_UINT256, POOL_WRITE_ABI, WETH_ABI } from "../src/aave/abi.ts";
import { readTokenBalance } from "../src/aave/position.ts";
import {
  executeContractCall,
  pollUntilTerminal,
  simulateContractCall,
  type ContractCallRequest,
} from "../src/keeperhub/client.ts";

const WETH = "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c";
const USDC = "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8";
const USDC_DECIMALS = 1_000_000n;

const USAGE = `
seed-position -- open an Aave V3 position on Ethereum Sepolia via KeeperHub.
  Supplies WETH as collateral, then borrows USDC (variable).

USAGE
  seed-position [--chain 11155111] [--wrap <ETH>] [--supply <WETH>] [--borrow <USDC>] [--skip-simulate]

DEFAULTS
  --wrap 0.04  --supply 0.02  --borrow 35
  Each step is simulate-first, idempotent, then polled to a verified receipt.
`.trim();

function parseFlags(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--skip-simulate") { out["skip-simulate"] = true; continue; }
    if (a === "--borrow-only") { out["borrow-only"] = true; continue; }
    if (a.startsWith("--")) {
      const val = argv[i + 1];
      if (val === undefined || val.startsWith("--")) throw new Error(`Flag ${a} requires a value`);
      out[a.slice(2)] = val;
      i++;
    }
  }
  return out;
}

function toWei(amount: string): string {
  const n = BigInt(Math.round(Number(amount) * 1e18));
  return n.toString();
}

function toUSDC(amount: string): string {
  const n = BigInt(Math.round(Number(amount) * Number(USDC_DECIMALS)));
  return n.toString();
}

async function step(
  chainId: string,
  label: string,
  req: ContractCallRequest,
  taskId: string,
  skipSimulate: boolean
): Promise<void> {
  console.log(`\n==> ${label}`);
  if (!skipSimulate) {
    console.log(`    simulate...`);
    const sim = await simulateContractCall(req);
    console.log(`    sim success=${sim.success} gas=${sim.gasEstimate ?? "?"} wouldRevert=${sim.wouldRevert ?? false}`);
    if (sim.success !== true) throw new Error(`simulate failed for ${label}: ${JSON.stringify(sim)}`);
  }
  const result = await executeContractCall(req, taskId);
  console.log(`    broadcast executionId=${result.executionId} status=${result.status} replay=${result.idempotentReplay ?? false}`);
  const final = await pollUntilTerminal(result.executionId, { maxSeconds: 300 });
  console.log(`    final status=${final.status}`);
  if (final.status !== "completed") {
    console.log(`    error=${final.error ?? "unknown"}`);
    throw new Error(`${label} did not complete: ${final.status}`);
  }
  for (const r of final.receipts ?? []) {
    console.log(`    receipt hash=${r.hash} chain=${r.chainId} verified=${r.verified} status=${r.receiptStatus} block=${r.blockNumber} gas=${r.gasUsed}`);
  }
  if (final.transactionLink) console.log(`    tx: ${final.transactionLink}`);
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const cfg = getConfig();
  if (!cfg.apiKey) throw new Error("KEEPERHUB_API_KEY is not set (copy .env.example to .env)");
  if (!cfg.user) throw new Error("SENTINEL_USER is not set");

  const chain = getAaveChain(String(flags.chain ?? cfg.chainId));
  const user = cfg.user;
  const wrap = toWei(String(flags.wrap ?? "0.04"));
  const supply = toWei(String(flags.supply ?? "0.02"));
  const borrow = toUSDC(String(flags.borrow ?? "35"));
  const skipSimulate = flags["skip-simulate"] === true;
  const borrowOnly = flags["borrow-only"] === true;

  console.log(`Solvency Sentinel — position seed on ${chain.name} (${chain.chainId})`);
  console.log(`user=${user}`);
  console.log(`pool=${chain.pool}`);
  console.log(`weth=${WETH}`);
  console.log(`usdc=${USDC}`);
  console.log(`wrap=${wrap} supply=${supply} borrow=${borrow} (wei)`);

  if (chain.chainId !== "11155111") {
    throw new Error(`seed-position is hardcoded for Ethereum Sepolia (11155111), got ${chain.chainId}`);
  }

  if (!borrowOnly) {
    await step(
      chain.chainId,
      "1/4 wrap ETH -> WETH (WETH.deposit)",
      { chainId: chain.chainId, contractAddress: WETH, functionName: "deposit", functionArgs: "[]", abi: WETH_ABI, value: String(flags.wrap ?? "0.04") },
      `seed|${user.slice(2, 10)}|wrap|${wrap}`,
      skipSimulate
    );

    await step(
      chain.chainId,
      "2/4 approve WETH -> Aave pool",
      { chainId: chain.chainId, contractAddress: WETH, functionName: "approve", functionArgs: JSON.stringify([chain.pool, MAX_UINT256]), abi: ERC20_ABI },
      `seed|${user.slice(2, 10)}|approve|${chain.pool}`,
      skipSimulate
    );

    await step(
      chain.chainId,
      "3/4 supply WETH collateral",
      { chainId: chain.chainId, contractAddress: chain.pool, functionName: "supply", functionArgs: JSON.stringify([WETH, supply, user, 0]), abi: POOL_WRITE_ABI },
      `seed|${user.slice(2, 10)}|supply|${WETH}|${supply}`,
      skipSimulate
    );
  }

  await step(
    chain.chainId,
    "4/4 borrow USDC (variable)",
    { chainId: chain.chainId, contractAddress: chain.pool, functionName: "borrow", functionArgs: JSON.stringify([USDC, borrow, 2, 0, user]), abi: POOL_WRITE_ABI },
    `seed|${user.slice(2, 10)}|borrow|${USDC}|${borrow}`,
    skipSimulate
  );

  const usdcBal = await readTokenBalance(chain, USDC, user);
  console.log(`\nposition seeded. wallet USDC balance now = ${(Number(usdcBal) / 1e6).toFixed(6)}`);
  console.log(`run: npm run check -- --chain ${chain.chainId} --user ${user}`);
  console.log(`protect: npm run monitor -- --chain ${chain.chainId} --user ${user} --critical 1.5 --target 2 --yes`);
}

main().catch((err) => {
  console.error(`error: ${(err as Error).message}`);
  process.exit(1);
});
