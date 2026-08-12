import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomBytes } from "node:crypto";
import { isAddress } from "viem";
import express from "express";
import { z } from "zod";
import { runSentinel, realOps, type SentinelApprovalRequest, type SentinelApprovalDecision } from "./sentinel.ts";
import { getAaveChain } from "./aave/chains.ts";
import { decideAction, formatAccountData } from "./aave/health.ts";
import { readAccountData } from "./aave/position.ts";
import { getExecutionStatus, setApiKeyOverride } from "./keeperhub/client.ts";
import { dryRunOps } from "./keeperhub/mock.ts";
import { writeRunReport } from "./report.ts";
import { getConfig } from "./config.ts";
import { installOAuth } from "./oauth.ts";
import { DEMO_CHAIN, DEMO_USER, landingPage } from "./landing.ts";
import { ownsPosition, registerPosition } from "./ownership.ts";
import { portalPage } from "./portal.ts";
import {
  decryptSecret,
  encryptSecret,
  hashPassword,
  parseCookies,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  signSession,
  verifyPassword,
  verifySession,
  type SessionPayload,
} from "./auth.ts";
import { getStore, randomId, type ApprovalStatus } from "./db.ts";

const server = new McpServer({
  name: "solvency-sentinel",
  version: "1.0.0",
});

interface TrackCall {
  tool: string;
  args: unknown;
  ok: boolean;
  ms: number;
}

function registerTools(s: McpServer, onCall?: (c: TrackCall) => void): McpServer {
  const track =
    <A, R>(tool: string, fn: (args: A) => Promise<R>) =>
    async (args: A): Promise<R> => {
      const t0 = Date.now();
      try {
        const res = await fn(args);
        onCall?.({ tool, args, ok: true, ms: Date.now() - t0 });
        return res;
      } catch (err) {
        onCall?.({ tool, args, ok: false, ms: Date.now() - t0 });
        throw err;
      }
    };

  s.tool(
    "sentinel_check",
    "Read an Aave V3 position health factor and decide the risk level. Read-only — never broadcasts.",
    {
      chainId: z.string().describe("Aave V3 chain id (84532, 11155111, 8453, 42161, 137, 1)"),
      user: z.string().describe("Address of the position to protect"),
    },
    track("sentinel_check", async (args: { chainId: string; user: string }) => {
      const { chainId, user } = args;
      const chain = getAaveChain(chainId);
      const account = await readAccountData(chain, user);
      const cfg = getConfig();
      const decision = decideAction(account, { criticalHf: cfg.criticalHf, targetHf: cfg.targetHf });
      return {
        content: [{ type: "text", text: JSON.stringify({ account: formatAccountData(account), decision }, null, 2) }],
      };
    })
  );

  s.tool(
    "sentinel_monitor",
    "Run the Solvency Sentinel protect loop: read position -> evaluate -> preflight simulate -> idempotent broadcast -> poll -> verify. Writes an audit report. A real broadcast is NOT executed until the position owner approves it in the dashboard (Approvals tab) — the tool waits while the approval is pending and reports the decision. Preview first with dryRun: true.",
    {
      chainId: z.string().describe("Aave V3 chain id (84532, 11155111, 8453, 42161, 137, 1)"),
      user: z.string().describe("Address of the position to protect"),
      criticalHf: z.number().optional().describe("Act below this health factor (default 1.05)"),
      targetHf: z.number().optional().describe("Restore to at least this health factor (default 1.5)"),
      dryRun: z.boolean().optional().describe("Simulate the whole loop locally, never broadcast. Use true to preview before the real run."),
    },
    track(
      "sentinel_monitor",
      async (args: { chainId: string; user: string; criticalHf?: number; targetHf?: number; dryRun?: boolean }) => {
        const { chainId, user, criticalHf, targetHf, dryRun } = args;
        const cfg = getConfig();
        const isDryRun = dryRun ?? false;
        if (!isDryRun && !(await ownsPosition(chainId, user))) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    ok: false,
                    level: "unverified",
                    error: `Refusing to broadcast — no proof that ${user} owns this position. Ownership is verified by a one-time signature from that wallet. Ask the position owner to sign the message on the Solvency Sentinel page (or call sentinel_register), then retry.`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
        const report = await runSentinel({
          chainId,
          user,
          policy: {
            criticalHf: criticalHf ?? cfg.criticalHf,
            targetHf: targetHf ?? cfg.targetHf,
          },
          taskId: `sentinel-mcp-${user.slice(2, 10)}-${Date.now()}`,
          confirm: false,
          dryRun: isDryRun,
          ops: isDryRun ? dryRunOps() : undefined,
          requestApproval: isDryRun ? undefined : makeApprovalHook(chainId, user),
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
    )
  );

  s.tool(
    "sentinel_register",
    "Register proof of ownership for an Aave position so sentinel_monitor is allowed to broadcast rescues against it. The position owner must sign the message with the owning wallet (personal_sign); the server recovers and verifies the signer. Recording ownership is a read-only side effect — it never broadcasts.",
    {
      chainId: z.string().describe("Aave V3 chain id (84532, 11155111, 8453, 42161, 137, 1)"),
      user: z.string().describe("Address of the position being claimed"),
      message: z.string().describe("The exact message the wallet signed"),
      signature: z.string().describe("The hex signature from personal_sign"),
    },
    track(
      "sentinel_register",
      async (args: { chainId: string; user: string; message: string; signature: string }) => {
        const { chainId, user, message, signature } = args;
        const result = await registerPosition({ chainId, address: user, message, signature });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
    )
  );

  s.tool(
    "sentinel_status",
    "Fetch the status and verified receipts of a KeeperHub direct execution.",
    { executionId: z.string().describe("KeeperHub execution id, e.g. direct_123") },
    track("sentinel_status", async (args: { executionId: string }) => {
      const { executionId } = args;
      const status = await getExecutionStatus(executionId);
      return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
    })
  );

  return s;
}

function makeApprovalHook(
  chainId: string,
  user: string
): (approval: SentinelApprovalRequest) => Promise<SentinelApprovalDecision> {
  return async (approval) => {
    const store = await getStore();
    const timeoutMs = (Number(process.env.APPROVAL_TIMEOUT_SECONDS ?? 300) || 300) * 1000;
    const positions = await store.ownedPositions();
    const ownerId = positions.find(
      (p) => p.chainId === chainId && p.address.toLowerCase() === user.toLowerCase()
    )?.ownerId;
    await store.createApproval({
      id: approval.id,
      chainId: approval.chainId,
      user: approval.user,
      taskId: approval.taskId,
      summary: approval.summary,
      payload: approval.payload,
      createdAt: approval.createdAt,
      status: "pending",
      ownerId,
    });
    console.error(`[sentinel] approval ${approval.id} pending for ${approval.summary} (timeout ${timeoutMs / 1000}s)`);
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const current = await store.findApproval(approval.id);
      if (current && current.status !== "pending") {
        console.error(`[sentinel] approval ${approval.id} resolved: ${current.status}`);
        return current.status as SentinelApprovalDecision;
      }
      if (Date.now() >= deadline) {
        await store.resolveApproval(approval.id, "timeout");
        console.error(`[sentinel] approval ${approval.id} timed out`);
        return "timeout";
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  };
}

function buildServer(onCall?: (c: TrackCall) => void): McpServer {
  return registerTools(new McpServer({ name: "solvency-sentinel", version: "1.0.0" }), onCall);
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

  app.get("/", (_req, res) => {
    res.type("html").send(landingPage);
  });

  app.get("/portal", (_req, res) => {
    res.type("html").send(portalPage);
  });

  app.get("/api/status", async (req, res) => {
    try {
      const chainId = (req.query.chainId as string | undefined) ?? DEMO_CHAIN;
      const user = (req.query.user as string | undefined) ?? DEMO_USER;
      if (!isAddress(user)) {
        res.status(400).json({ ok: false, error: `Invalid address: ${user}` });
        return;
      }
      const chain = getAaveChain(chainId);
      const account = await readAccountData(chain, user);
      const cfg = getConfig();
      const decision = decideAction(account, { criticalHf: cfg.criticalHf, targetHf: cfg.targetHf });
      res.json({ ok: true, timestamp: Date.now(), chainId, user, account: formatAccountData(account), decision });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/dryrun", async (req, res) => {
    try {
      const body = (req.body ?? {}) as { user?: string; chainId?: string };
      const chainId = body.chainId ?? DEMO_CHAIN;
      const user = body.user ?? DEMO_USER;
      if (!isAddress(user)) {
        res.status(400).json({ ok: false, error: `Invalid address: ${user}` });
        return;
      }
      const cfg = getConfig();
      const report = await runSentinel({
        chainId,
        user,
        policy: { criticalHf: cfg.criticalHf, targetHf: cfg.targetHf },
        taskId: `web-demo-${Date.now()}`,
        confirm: false,
        dryRun: true,
        ops: dryRunOps(),
        onLog: (line) => console.error(line),
      });
      res.json({ ok: true, report });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/register-position", async (req, res) => {
    try {
      const body = (req.body ?? {}) as { chainId?: string; address?: string; message?: string; signature?: string };
      const session = sessionUser(req);
      const result = await registerPosition({
        chainId: body.chainId ?? DEMO_CHAIN,
        address: body.address ?? "",
        message: body.message ?? "",
        signature: body.signature ?? "",
        ownerId: session?.uid,
      });
      res.json({ ok: result.ok, error: result.error, chainId: body.chainId ?? DEMO_CHAIN, address: body.address });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  const sessionUser = (req: express.Request): SessionPayload | null => {
    const cookies = parseCookies(req.headers.cookie);
    return verifySession(cookies[SESSION_COOKIE]);
  };

  const requireUser = (req: express.Request): SessionPayload | null => sessionUser(req);

  const cookieOptions = (req: express.Request) => ({
    httpOnly: true,
    sameSite: "lax" as const,
    secure: (req.headers["x-forwarded-proto"] ?? "http") === "https",
    path: "/",
    maxAge: SESSION_TTL_MS,
  });

  app.post("/api/portal/register", async (req, res) => {
    try {
      const body = (req.body ?? {}) as { email?: string; password?: string };
      const email = (body.email ?? "").trim().toLowerCase();
      const password = body.password ?? "";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        res.json({ ok: false, error: "Enter a valid email address." });
        return;
      }
      if (password.length < 8) {
        res.json({ ok: false, error: "Password must be at least 8 characters." });
        return;
      }
      const store = await getStore();
      if (await store.findUserByEmail(email)) {
        res.json({ ok: false, error: "An account with that email already exists. Log in instead." });
        return;
      }
      const { salt, hash } = hashPassword(password);
      const user = { id: randomId(), email, passwordHash: hash, salt, createdAt: Date.now() };
      await store.createUser(user);
      res.cookie(SESSION_COOKIE, signSession({ uid: user.id, email }), cookieOptions(req));
      res.json({ ok: true, email });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/portal/login", async (req, res) => {
    try {
      const body = (req.body ?? {}) as { email?: string; password?: string };
      const email = (body.email ?? "").trim().toLowerCase();
      const user = await (await getStore()).findUserByEmail(email);
      if (!user || !verifyPassword(body.password ?? "", user.salt, user.passwordHash)) {
        res.status(401).json({ ok: false, error: "Invalid email or password." });
        return;
      }
      res.cookie(SESSION_COOKIE, signSession({ uid: user.id, email: user.email }), cookieOptions(req));
      res.json({ ok: true, email: user.email });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/portal/logout", (req, res) => {
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.json({ ok: true });
  });

  app.get("/api/portal/me", async (req, res) => {
    try {
      const session = requireUser(req);
      if (!session) {
        res.status(401).json({ ok: false, error: "Not signed in." });
        return;
      }
      const store = await getStore();
      const [positions, credentials, plugins, approvals, activity] = await Promise.all([
        store.listPositionsForOwner(session.uid),
        store.listCredentials(session.uid),
        store.listPlugins(session.uid),
        store.listApprovals({ ownerId: session.uid }),
        store.listActivity(30),
      ]);
      res.json({
        ok: true,
        user: { email: session.email },
        positions: positions.map((p) => ({ address: p.address, chainId: p.chainId, registeredAt: p.registeredAt })),
        credentials: credentials.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          masked: c.type === "keeperhub-api-key" ? "kh_key_" + "•".repeat(8) + c.valueEnc.slice(-10) : "0x" + "•".repeat(8) + c.valueEnc.slice(-10),
          createdAt: c.createdAt,
        })),
        plugins,
        approvals: approvals.map((a) => ({
          id: a.id,
          chainId: a.chainId,
          user: a.user,
          taskId: a.taskId,
          summary: a.summary,
          payload: JSON.stringify(a.payload ?? {}),
          status: a.status,
          createdAt: a.createdAt,
          resolvedAt: a.resolvedAt,
          resolvedBy: a.resolvedBy,
        })),
        activity: activity.map((a) => ({ id: a.id, tool: a.tool, args: a.args, ok: a.ok, ms: a.ms, at: a.at })),
        agent: {
          serverUrl: `${publicUrl}/mcp`,
          token,
          tools: [
            ["sentinel_check", "Read a position's health factor and risk level (read-only)."],
            ["sentinel_monitor", "Full protect loop: read, evaluate, simulate, broadcast (held for approval), poll, verify."],
            ["sentinel_register", "Record proof of ownership via the wallet's signature."],
            ["sentinel_status", "Fetch status and verified receipts of a KeeperHub execution."],
          ],
        },
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/portal/credentials", async (req, res) => {
    try {
      const session = requireUser(req);
      if (!session) {
        res.status(401).json({ ok: false, error: "Not signed in." });
        return;
      }
      const body = (req.body ?? {}) as { name?: string; type?: string; value?: string };
      const name = (body.name ?? "").trim();
      const type = body.type;
      const value = (body.value ?? "").trim();
      if (!name || !value) {
        res.json({ ok: false, error: "Name and value are required." });
        return;
      }
      if (type !== "keeperhub-api-key" && type !== "rescue-wallet-key") {
        res.json({ ok: false, error: "Unknown credential type." });
        return;
      }
      if (type === "rescue-wallet-key" && !/^0x[0-9a-fA-F]{64}$/.test(value)) {
        res.json({ ok: false, error: "Rescue wallet key must be 0x + 64 hex chars." });
        return;
      }
      const store = await getStore();
      await store.upsertCredential({
        id: randomId(),
        userId: session.uid,
        name,
        type: type as "keeperhub-api-key" | "rescue-wallet-key",
        valueEnc: encryptSecret(value),
        createdAt: Date.now(),
      });
      res.json({ ok: true, credentials: await store.listCredentials(session.uid) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete("/api/portal/credentials/:id", async (req, res) => {
    const session = requireUser(req);
    if (!session) {
      res.status(401).json({ ok: false, error: "Not signed in." });
      return;
    }
    await (await getStore()).deleteCredential(session.uid, req.params.id as string);
    res.json({ ok: true });
  });

  app.post("/api/portal/plugins", async (req, res) => {
    try {
      const session = requireUser(req);
      if (!session) {
        res.status(401).json({ ok: false, error: "Not signed in." });
        return;
      }
      const body = (req.body ?? {}) as {
        chainId?: string;
        protocol?: string;
        enabled?: boolean;
        criticalHf?: number;
        targetHf?: number;
      };
      const chainId = String(body.chainId ?? "");
      if (!chainId || !Number(chainId)) {
        res.json({ ok: false, error: "A valid chain id is required." });
        return;
      }
      const criticalHf = Number(body.criticalHf ?? 1.05);
      const targetHf = Number(body.targetHf ?? 1.5);
      if (!Number.isFinite(criticalHf) || !Number.isFinite(targetHf) || targetHf <= criticalHf) {
        res.json({ ok: false, error: "targetHf must be greater than criticalHf." });
        return;
      }
      const store = await getStore();
      await store.upsertPlugin({
        id: randomId(),
        userId: session.uid,
        chainId,
        protocol: body.protocol ?? "aave-v3",
        enabled: body.enabled ?? false,
        criticalHf,
        targetHf,
        updatedAt: Date.now(),
      });
      res.json({ ok: true, plugins: await store.listPlugins(session.uid) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete("/api/portal/plugins/:id", async (req, res) => {
    const session = requireUser(req);
    if (!session) {
      res.status(401).json({ ok: false, error: "Not signed in." });
      return;
    }
    await (await getStore()).deletePlugin(session.uid, req.params.id as string);
    res.json({ ok: true });
  });

  app.get("/api/portal/approvals", async (req, res) => {
    try {
      const session = requireUser(req);
      if (!session) {
        res.status(401).json({ ok: false, error: "Not signed in." });
        return;
      }
      const store = await getStore();
      const approvals = await store.listApprovals({ ownerId: session.uid });
      res.json({
        ok: true,
        approvals: approvals.map((a) => ({
          id: a.id,
          chainId: a.chainId,
          user: a.user,
          taskId: a.taskId,
          summary: a.summary,
          payload: JSON.stringify(a.payload ?? {}),
          status: a.status,
          createdAt: a.createdAt,
          resolvedAt: a.resolvedAt,
          resolvedBy: a.resolvedBy,
        })),
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/portal/approvals/:id/resolve", async (req, res) => {
    try {
      const session = requireUser(req);
      if (!session) {
        res.status(401).json({ ok: false, error: "Not signed in." });
        return;
      }
      const body = (req.body ?? {}) as { decision?: string };
      const decision = body.decision;
      if (decision !== "approved" && decision !== "rejected") {
        res.json({ ok: false, error: "decision must be 'approved' or 'rejected'." });
        return;
      }
      await (await getStore()).resolveApproval(req.params.id as string, decision as Exclude<ApprovalStatus, "pending">, session.email);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/portal/protect/dryrun", async (req, res) => {
    try {
      const session = requireUser(req);
      if (!session) {
        res.status(401).json({ ok: false, error: "Not signed in." });
        return;
      }
      const body = (req.body ?? {}) as { user?: string; chainId?: string };
      const user = body.user ?? "";
      const chainId = String(body.chainId ?? DEMO_CHAIN);
      if (!isAddress(user)) {
        res.json({ ok: false, error: `Invalid address: ${user}` });
        return;
      }
      const store = await getStore();
      const creds = await store.listCredentials(session.uid);
      const apiKeyCred = creds.find((c) => c.type === "keeperhub-api-key");
      const apiKey = apiKeyCred ? decryptSecret(apiKeyCred.valueEnc) : undefined;
      setApiKeyOverride(apiKey);
      const cfg = getConfig();
      const report = await runSentinel({
        chainId,
        user,
        policy: { criticalHf: cfg.criticalHf, targetHf: cfg.targetHf },
        taskId: `portal-dryrun-${session.uid.slice(0, 6)}-${Date.now()}`,
        confirm: false,
        dryRun: true,
        ops: realOps,
        onLog: (line) => console.error(line),
      });
      setApiKeyOverride(undefined);
      await store.recordActivity({
        id: randomId(),
        agent: "dashboard",
        tool: "sentinel_monitor(dryRun)",
        args: JSON.stringify({ chainId, user }),
        ok: true,
        ms: 0,
        at: Date.now(),
      });
      res.json({ ok: true, report, usedCredential: apiKey ? "user" : "env" });
    } catch (err) {
      setApiKeyOverride(undefined);
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
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

  const mcpAuthGate: express.RequestHandler = (req, res, next) => {
    if (allowLegacyToken(req)) return next();
    requireMcpAuth(req, res, next);
  };

  const acceptPatch: express.RequestHandler = (req, _res, next) => {
    const accept = req.headers.accept;
    if (!accept || !/(application\/json|text\/event-stream)/.test(accept)) {
      req.headers.accept = "application/json, text/event-stream";
    }
    next();
  };

  const openSession = async (req: express.Request, res: express.Response): Promise<void> => {
    const server = buildServer((c) => {
      void (async () => {
        try {
          const args = JSON.stringify(c.args);
          await (await getStore()).recordActivity({
            id: randomId(),
            agent: "mcp",
            tool: c.tool,
            args: args.length > 300 ? args.slice(0, 300) + "…" : args,
            ok: c.ok,
            ms: c.ms,
            at: Date.now(),
          });
        } catch {
          /* activity logging must never break a tool call */
        }
      })();
    });
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
  };

  const handlePost: express.RequestHandler = async (req, res) => {
    const sid = sessionHeader(req);
    if (sid) {
      const session = sessions.get(sid);
      if (!session) {
        const body = (req.body ?? {}) as { method?: string };
        if (body.method === "initialize") {
          return await openSession(req, res);
        }
        return sessionNotFound(res);
      }
      return await session.transport.handleRequest(req, res, req.body);
    }
    return await openSession(req, res);
  };

  const handleDelete: express.RequestHandler = async (req, res) => {
    const sid = sessionHeader(req);
    const session = sid ? sessions.get(sid) : undefined;
    if (!session) return res.status(404).json({ error: "session not found" });
    await session.transport.handleRequest(req, res, req.body);
    if (sid) sessions.delete(sid);
  };

  for (const path of ["/", "/mcp"]) {
    app.post(path, mcpAuthGate, acceptPatch, handlePost);
    app.delete(path, mcpAuthGate, acceptPatch, handleDelete);
  }

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
