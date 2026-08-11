import { getConfig } from "./config.ts";
import { getAaveChain } from "./aave/chains.ts";
import { decideAction, formatAccountData } from "./aave/health.ts";
import { readAccountData } from "./aave/position.ts";
import { runSentinel } from "./sentinel.ts";
import { writeRunReport } from "./report.ts";
import { checkAndExecute, getExecutionStatus } from "./keeperhub/client.ts";
import { dryRunOps } from "./keeperhub/mock.ts";
import { ERC20_ABI } from "./aave/abi.ts";

const USAGE = `
Solvency Sentinel — an agent that protects a DeFi lending position through KeeperHub.

USAGE
  sentinel check    [--chain <id>] [--user <0x...>]          Read position, print health factor (no action).
  sentinel monitor  [--chain <id>] [--user <0x...>] [--critical <hf>] [--target <hf>] [--yes]
                                                             One-shot: read -> evaluate -> preflight -> execute -> verify.
  sentinel watch    [--chain <id>] [--user <0x...>] [--interval <sec>] [--critical <hf>] [--target <hf>] [--yes]
                                                             Loop the monitor on a cadence.
  sentinel atom     [--chain <id>] [--check-contract <0x...>] [--check-fn <name>] [--check-args <json>]
                                                             [--op <gt|gte|lt|lte|eq|neq>] [--value <scalar>]
                                                             [--action-contract <0x...>] [--action-fn <name>] [--action-args <json>] [--simulate]
                                                             Atomic read-check-execute in ONE KeeperHub call.
  sentinel status   <executionId>                            Poll an execution to terminal state.

FLAGS
  --chain <id>         chain id (default 84532 Base Sepolia)
  --user <0x...>       address to protect (default $SENTINEL_USER)
  --critical <hf>      act below this health factor (default 1.05)
  --target <hf>        restore to at least this (default 1.5)
  --interval <sec>     watch cadence (default 60)
  --yes                skip the broadcast confirmation
  --json               print the run report as JSON
  --dry-run            simulate the whole loop locally (no KeeperHub API key needed)
  --scenario <json>    dry-run scenario overrides, e.g. '{"healthFactor":1.02}'

ENV
  KEEPERHUB_API_KEY    org API key (required)
  KEEPERHUB_BASE_URL   default https://app.keeperhub.com
`.trim();

function parseFlags(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--yes") { out.yes = true; continue; }
    if (a === "--json") { out.json = true; continue; }
    if (a === "--simulate") { out.simulate = true; continue; }
    if (a === "--dry-run") { out["dry-run"] = true; continue; }
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val === undefined || val.startsWith("--")) {
        throw new Error(`Flag ${a} requires a value`);
      }
      out[key] = val;
      i++;
    }
  }
  return out;
}

function str(flags: Record<string, string | boolean>, key: string, fallback: string): string {
  const v = flags[key];
  return typeof v === "string" && v !== "" ? v : fallback;
}

function num(flags: Record<string, string | boolean>, key: string, fallback: number): number {
  const v = str(flags, key, String(fallback));
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function runCheck(flags: Record<string, string | boolean>): Promise<void> {
  const cfg = getConfig();
  const chain = getAaveChain(str(flags, "chain", cfg.chainId));
  const user = str(flags, "user", cfg.user);
  if (!user) throw new Error("--user is required (or set SENTINEL_USER)");
  const dryRun = flags["dry-run"] === true;
  const ops = dryRun ? dryRunOps() : undefined;
  const account = dryRun
    ? await ops!.readAccountData(chain, user)
    : await readAccountData(chain, user);
  const decision = decideAction(account, { criticalHf: cfg.criticalHf, targetHf: cfg.targetHf });
  if (flags.json) {
    console.log(JSON.stringify({ account: formatAccountData(account), decision }, null, 2));
  } else {
    for (const [k, v] of Object.entries(formatAccountData(account))) console.log(`${k}: ${v}`);
    console.log(`level: ${decision.level} (${decision.reason})`);
  }
}

async function runMonitor(flags: Record<string, string | boolean>): Promise<void> {
  const cfg = getConfig();
  const user = str(flags, "user", cfg.user);
  if (!user) throw new Error("--user is required (or set SENTINEL_USER)");
  const dryRun = flags["dry-run"] === true;
  const scenario = typeof flags.scenario === "string" ? (JSON.parse(flags.scenario) as object) : {};
  const report = await runSentinel({
    chainId: str(flags, "chain", cfg.chainId),
    user,
    policy: {
      criticalHf: num(flags, "critical", cfg.criticalHf),
      targetHf: num(flags, "target", cfg.targetHf),
    },
    taskId: `sentinel-monitor-${user.slice(2, 10)}`,
    confirm: !flags.yes && cfg.confirm && !dryRun,
    dryRun,
    ops: dryRun ? dryRunOps(scenario) : undefined,
  });
  const paths = writeRunReport(report);
  if (flags.json) console.log(JSON.stringify(report, null, 2));
  else console.log(`[sentinel] run report: ${paths.mdPath}`);
}

async function runWatch(flags: Record<string, string | boolean>): Promise<void> {
  const cfg = getConfig();
  const interval = num(flags, "interval", cfg.intervalSeconds);
  const user = str(flags, "user", cfg.user);
  if (!user) throw new Error("--user is required (or set SENTINEL_USER)");
  const chainId = str(flags, "chain", cfg.chainId);
  const policy = {
    criticalHf: num(flags, "critical", cfg.criticalHf),
    targetHf: num(flags, "target", cfg.targetHf),
  };
  const dryRun = flags["dry-run"] === true;
  const scenario = typeof flags.scenario === "string" ? (JSON.parse(flags.scenario) as object) : {};
  const bucket = () => new Date().toISOString().slice(0, 13);
  console.log(`[sentinel] watching ${chainId} user ${user} every ${interval}s (Ctrl-C to stop)${dryRun ? " [DRY RUN]" : ""}`);
  for (let cycle = 1; ; cycle++) {
    try {
      const report = await runSentinel({
        chainId,
        user,
        policy,
        taskId: `sentinel-watch-${user.slice(2, 10)}-${bucket()}-c${cycle}`,
        confirm: !flags.yes && cfg.confirm && !dryRun,
        dryRun,
        ops: dryRun ? dryRunOps(scenario) : undefined,
      });
      const paths = writeRunReport(report);
      console.log(`[sentinel] cycle ${cycle}: ${report.decision.level} — ${paths.jsonPath}`);
    } catch (err) {
      console.error(`[sentinel] cycle ${cycle} failed: ${(err as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, interval * 1000));
  }
}

async function runAtom(flags: Record<string, string | boolean>): Promise<void> {
  const cfg = getConfig();
  const chainId = str(flags, "chain", cfg.chainId);
  const checkContract = str(flags, "check-contract", "0x4200000000000000000000000000000000000006"); // WETH on Base
  const actionContract = str(flags, "action-contract", checkContract);
  const simulate = flags.simulate === true;

  const result = await checkAndExecute(
    {
      contractAddress: checkContract,
      chainId,
      functionName: str(flags, "check-fn", "balanceOf"),
      functionArgs: flags["check-args"] ? String(flags["check-args"]) : undefined,
      abi: ERC20_ABI,
      condition: {
        operator: (str(flags, "op", "lt") as "gt") as "gt" | "gte" | "lt" | "lte" | "eq" | "neq",
        value: str(flags, "value", "0"),
      },
      action: {
        contractAddress: actionContract,
        functionName: str(flags, "action-fn", "transfer"),
        functionArgs: flags["action-args"] ? String(flags["action-args"]) : undefined,
        abi: ERC20_ABI,
      },
    },
    { simulate, taskId: `sentinel-atom-${chainId}` }
  );
  console.log(JSON.stringify(result, null, 2));
}

async function runStatus(argv: string[]): Promise<void> {
  const id = argv.find((a) => !a.startsWith("--"));
  if (!id) throw new Error("sentinel status <executionId>");
  const res = await getExecutionStatus(id);
  console.log(JSON.stringify(res, null, 2));
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const flags = parseFlags(argv.slice(1));
  switch (cmd) {
    case "check": return runCheck(flags);
    case "monitor": return runMonitor(flags);
    case "watch": return runWatch(flags);
    case "atom": return runAtom(flags);
    case "status": return runStatus(argv.slice(1));
    case "-h": case "--help": case "help": default:
      console.log(USAGE);
      if (cmd && cmd !== "help" && cmd !== "-h" && cmd !== "--help") process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`error: ${(err as Error).message}`);
  process.exit(1);
});
