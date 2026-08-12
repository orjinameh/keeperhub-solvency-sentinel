import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomBytes } from "node:crypto";
import express from "express";
import { z } from "zod";
import { runSentinel } from "./sentinel.ts";
import { getAaveChain } from "./aave/chains.ts";
import { decideAction, formatAccountData } from "./aave/health.ts";
import { readAccountData } from "./aave/position.ts";
import { getExecutionStatus } from "./keeperhub/client.ts";
import { dryRunOps } from "./keeperhub/mock.ts";
import { writeRunReport } from "./report.ts";
import { getConfig } from "./config.ts";
import { installOAuth } from "./oauth.ts";

const server = new McpServer({
  name: "solvency-sentinel",
  version: "1.0.0",
});

function registerTools(s: McpServer): McpServer {
  s.tool(
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

  s.tool(
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

  s.tool(
    "sentinel_status",
    "Fetch the status and verified receipts of a KeeperHub direct execution.",
    { executionId: z.string().describe("KeeperHub execution id, e.g. direct_123") },
    async ({ executionId }) => {
      const status = await getExecutionStatus(executionId);
      return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
    }
  );

  return s;
}

function buildServer(): McpServer {
  return registerTools(new McpServer({ name: "solvency-sentinel", version: "1.0.0" }));
}

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await buildServer().connect(transport);
}

async function runHttp(port: number, token: string): Promise<void> {
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));

  interface Session {
    server: McpServer;
    transport: StreamableHTTPServerTransport;
  }
  const sessions = new Map<string, Session>();

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  const publicUrl = process.env.PUBLIC_URL ?? `http://localhost:${port}`;
  const { requireMcpAuth } = installOAuth(app, publicUrl);

  const allowLegacyToken = (req: { headers: { authorization?: string } }): boolean =>
    req.headers.authorization === `Bearer ${token}`;

  const sessionHeader = (req: { headers: { [k: string]: string | string[] | undefined } }): string | undefined => {
    const v = req.headers["mcp-session-id"];
    return typeof v === "string" ? v : undefined;
  };

  const sessionNotFound = (res: express.Response): void => {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Session not found" },
      id: null,
    });
  };

  app.post(
    "/",
    (req, res, next) => {
      if (allowLegacyToken(req)) return next();
      requireMcpAuth(req, res, next);
    },
    async (req, res) => {
      const sid = sessionHeader(req);
      if (sid) {
        const session = sessions.get(sid);
        if (!session) return sessionNotFound(res);
        return await session.transport.handleRequest(req, res, req.body);
      }

      const server = buildServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomBytes(16).toString("hex"),
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      const sessionId = transport.sessionId;
      if (sessionId) {
        sessions.set(sessionId, { server, transport });
        transport.onclose = () => {
          sessions.delete(sessionId);
        };
      }
    }
  );

  app.delete(
    "/",
    (req, res, next) => {
      if (allowLegacyToken(req)) return next();
      requireMcpAuth(req, res, next);
    },
    async (req, res) => {
      const sid = sessionHeader(req);
      const session = sid ? sessions.get(sid) : undefined;
      if (!session) return res.status(404).json({ error: "session not found" });
      await session.transport.handleRequest(req, res, req.body);
      if (sid) sessions.delete(sid);
    }
  );

  app.listen(port, () => console.error(`[mcp] HTTP transport listening on :${port}`));
}

const argv = process.argv.slice(2);
if (argv.includes("--http") || process.env.MCP_HTTP === "1") {
  const port = Number(process.env.PORT ?? process.env.MCP_HTTP_PORT ?? "8321");
  const token = process.env.MCP_HTTP_TOKEN ?? randomBytes(18).toString("hex");
  console.error(`[mcp] bearer token: ${token}`);
  await runHttp(port, token);
} else {
  await runStdio();
}
