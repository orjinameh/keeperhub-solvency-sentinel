import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runSentinel } from "./sentinel.ts";
import { getAaveChain } from "./aave/chains.ts";
import { decideAction, formatAccountData } from "./aave/health.ts";
import { readAccountData } from "./aave/position.ts";
import { getExecutionStatus } from "./keeperhub/client.ts";
import { dryRunOps } from "./keeperhub/mock.ts";
import { writeRunReport } from "./report.ts";
import { getConfig } from "./config.ts";

const server = new McpServer({
  name: "solvency-sentinel",
  version: "1.0.0",
});

server.tool(
  "sentinel_check",
  "Read an Aave V3 position health factor and decide the risk level. Read-only — never broadcasts.",
  {
    chainId: z.string().describe("Aave V3 chain id (84532, 11155111, 8453, 42161, 137, 1)"),
    user: z.string().describe("Address of the position to protect"),
  },
  async ({ chainId, user }) => {
    const chain = getAaveChain(chainId);
    const account = await readAccountData(chain, user);
    const cfg = getConfig();
    const decision = decideAction(account, { criticalHf: cfg.criticalHf, targetHf: cfg.targetHf });
    return {
      content: [{ type: "text", text: JSON.stringify({ account: formatAccountData(account), decision }, null, 2) }],
    };
  }
);

server.tool(
  "sentinel_monitor",
  "Run the Solvency Sentinel protect loop: read position -> evaluate -> preflight simulate -> idempotent broadcast -> poll -> verify. Writes an audit report.",
  {
    chainId: z.string().describe("Aave V3 chain id (84532, 11155111, 8453, 42161, 137, 1)"),
    user: z.string().describe("Address of the position to protect"),
    criticalHf: z.number().optional().describe("Act below this health factor (default 1.05)"),
    targetHf: z.number().optional().describe("Restore to at least this health factor (default 1.5)"),
    confirm: z.boolean().optional().describe("Require operator confirmation before broadcast (default false — the model invoking the tool is the operator)"),
    dryRun: z.boolean().optional().describe("Simulate the whole loop locally, never broadcast"),
  },
  async ({ chainId, user, criticalHf, targetHf, confirm, dryRun }) => {
    const cfg = getConfig();
    const isDryRun = dryRun ?? false;
    const report = await runSentinel({
      chainId,
      user,
      policy: {
        criticalHf: criticalHf ?? cfg.criticalHf,
        targetHf: targetHf ?? cfg.targetHf,
      },
      taskId: `sentinel-mcp-${user.slice(2, 10)}-${Date.now()}`,
      confirm: confirm ?? false,
      dryRun: isDryRun,
      ops: isDryRun ? dryRunOps() : undefined,
      onLog: (line) => console.error(line),
    });
    const paths = writeRunReport(report);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ ...report, reportPath: paths.jsonPath }, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "sentinel_status",
  "Fetch the status and verified receipts of a KeeperHub direct execution.",
  { executionId: z.string().describe("KeeperHub execution id, e.g. direct_123") },
  async ({ executionId }) => {
    const status = await getExecutionStatus(executionId);
    return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
