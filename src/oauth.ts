import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Express, Request, RequestHandler, Response } from "express";
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { InvalidGrantError, InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { OAuthServerProvider, AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { OAuthClientInformationFull, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

const ACCESS_TTL_MS = 60 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;

const here = dirname(fileURLToPath(import.meta.url));
const statePath = resolve(here, "..", "data", "oauth-state.json");

interface AuthCodeRecord {
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  resource?: string;
  scopes: string[];
  expiresAt: number;
}

interface TokenRecord {
  clientId: string;
  scopes: string[];
  resource?: string;
  expiresAt: number;
}

interface PersistedState {
  clients: Record<string, OAuthClientInformationFull>;
  codes: Record<string, AuthCodeRecord>;
  access: Record<string, TokenRecord>;
  refresh: Record<string, TokenRecord>;
}

function emptyState(): PersistedState {
  return { clients: {}, codes: {}, access: {}, refresh: {} };
}

function loadState(): PersistedState {
  try {
    if (!existsSync(statePath)) return emptyState();
    const parsed = JSON.parse(readFileSync(statePath, "utf8")) as Partial<PersistedState>;
    const now = Date.now();
    const codes = parsed.codes ?? {};
    const access = parsed.access ?? {};
    const refresh = parsed.refresh ?? {};
    for (const k of Object.keys(codes)) { const rec = codes[k]; if (rec && rec.expiresAt < now) delete codes[k]; }
    for (const k of Object.keys(access)) { const rec = access[k]; if (rec && rec.expiresAt < now) delete access[k]; }
    for (const k of Object.keys(refresh)) { const rec = refresh[k]; if (rec && rec.expiresAt < now) delete refresh[k]; }
    return {
      clients: parsed.clients ?? {},
      codes,
      access,
      refresh,
    };
  } catch (err) {
    console.error("[oauth] failed to load persisted state:", err);
    return emptyState();
  }
}

class FileStore {
  readonly state: PersistedState = loadState();
  private timer: ReturnType<typeof setTimeout> | undefined;

  markDirty(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush(), 200);
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    try {
      mkdirSync(dirname(statePath), { recursive: true });
      const tmp = `${statePath}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.state), "utf8");
      renameSync(tmp, statePath);
    } catch (err) {
      console.error("[oauth] failed to persist state:", err);
    }
  }
}

class MemoryClientsStore implements OAuthRegisteredClientsStore {
  constructor(private readonly store: FileStore) {}

  getClient(clientId: string): OAuthClientInformationFull | undefined {
    return this.store.state.clients[clientId];
  }

  registerClient(client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">): OAuthClientInformationFull {
    const full = client as OAuthClientInformationFull;
    this.store.state.clients[full.client_id] = full;
    this.store.markDirty();
    return full;
  }
}

/**
 * Self-contained OAuth 2.1 authorization server for the MCP resource server.
 * Opaque in-memory tokens (no JWT) — access tokens are only valid against this
 * server instance and are bound to the RFC 8707 resource that was requested.
 */
export class LocalOAuthProvider implements OAuthServerProvider {
  readonly clientsStore: OAuthRegisteredClientsStore;

  constructor(private readonly store: FileStore) {
    this.clientsStore = new MemoryClientsStore(store);
  }

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    res.status(200).send(consentPage(client.client_id, params));
  }

  issueCode(
    clientId: string,
    codeChallenge: string,
    redirectUri: string,
    resource: URL | undefined,
    scopes: string[]
  ): string {
    const code = randomBytes(24).toString("hex");
    this.store.state.codes[code] = {
      clientId,
      codeChallenge,
      redirectUri,
      resource: resource?.href,
      scopes,
      expiresAt: Date.now() + CODE_TTL_MS,
    };
    this.store.markDirty();
    return code;
  }

  async challengeForAuthorizationCode(_client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    const rec = this.store.state.codes[authorizationCode];
    if (!rec) throw new InvalidGrantError("Invalid authorization code");
    return rec.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL
  ): Promise<OAuthTokens> {
    const rec = this.store.state.codes[authorizationCode];
    if (!rec || rec.clientId !== client.client_id) throw new InvalidGrantError("Invalid authorization code");
    delete this.store.state.codes[authorizationCode];
    if (redirectUri && redirectUri !== rec.redirectUri) throw new InvalidGrantError("redirect_uri does not match the authorization request");
    if (rec.expiresAt < Date.now()) throw new InvalidGrantError("Authorization code has expired");
    this.store.markDirty();
    return this.issueTokens(client.client_id, rec.scopes, resource ?? (rec.resource ? new URL(rec.resource) : undefined));
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL
  ): Promise<OAuthTokens> {
    const rec = this.store.state.refresh[refreshToken];
    if (!rec || rec.clientId !== client.client_id) throw new InvalidGrantError("Invalid refresh token");
    delete this.store.state.refresh[refreshToken];
    this.store.markDirty();
    return this.issueTokens(client.client_id, scopes ?? rec.scopes, resource ?? (rec.resource ? new URL(rec.resource) : undefined));
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const rec = this.store.state.access[token];
    if (!rec) throw new InvalidTokenError("Invalid access token");
    if (rec.expiresAt < Date.now()) {
      delete this.store.state.access[token];
      this.store.markDirty();
      throw new InvalidTokenError("Access token has expired");
    }
    return {
      token,
      clientId: rec.clientId,
      scopes: rec.scopes,
      expiresAt: Math.floor(rec.expiresAt / 1000),
      resource: rec.resource ? new URL(rec.resource) : undefined,
    };
  }

  async revokeToken(client: OAuthClientInformationFull, request: { token: string; token_type_hint?: string }): Promise<void> {
    if (!request.token_type_hint || request.token_type_hint === "access_token") {
      if (this.store.state.access[request.token]) {
        delete this.store.state.access[request.token];
        this.store.markDirty();
      }
    }
    if (!request.token_type_hint || request.token_type_hint === "refresh_token") {
      if (this.store.state.refresh[request.token]) {
        delete this.store.state.refresh[request.token];
        this.store.markDirty();
      }
    }
  }

  private issueTokens(clientId: string, scopes: string[], resource: URL | undefined): OAuthTokens {
    const accessToken = randomBytes(32).toString("hex");
    const refreshToken = randomBytes(32).toString("hex");
    this.store.state.access[accessToken] = { clientId, scopes, resource: resource?.href, expiresAt: Date.now() + ACCESS_TTL_MS };
    this.store.state.refresh[refreshToken] = { clientId, scopes, resource: resource?.href, expiresAt: Date.now() + REFRESH_TTL_MS };
    this.store.markDirty();
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: Math.floor(ACCESS_TTL_MS / 1000),
      refresh_token: refreshToken,
      scope: scopes.join(" "),
    };
  }
}

function consentPage(clientId: string, params: AuthorizationParams): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const fields: Array<[string, string]> = [
    ["client_id", clientId],
    ["redirect_uri", params.redirectUri],
    ["code_challenge", params.codeChallenge],
    ["state", params.state ?? ""],
    ["scope", (params.scopes ?? []).join(" ")],
    ["resource", params.resource?.href ?? ""],
  ];
  const inputs = fields.map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Authorize Solvency Sentinel</title>
<style>body{font-family:system-ui,sans-serif;max-width:34rem;margin:4rem auto;padding:0 1rem;color:#1a202c}
code{background:#f1f5f9;padding:.1rem .3rem;border-radius:.25rem;font-size:.85em}
button{margin-top:1rem;background:#16a34a;color:#fff;border:0;padding:.7rem 1.4rem;border-radius:.5rem;font-size:1rem;cursor:pointer}</style>
</head><body>
<h1>Authorize Solvency Sentinel</h1>
<p>A client requested access to your Solvency Sentinel MCP server
(<code>${esc(params.resource?.href ?? "this server")}</code>).</p>
<p>This lets the agent read the protected Aave position and execute rescue repayments.</p>
<form action="/consent" method="post">
${inputs}
<button type="submit">Authorize</button>
</form>
</body></html>`;
}

export interface OAuthInstallResult {
  requireMcpAuth: RequestHandler;
  provider: LocalOAuthProvider;
}

/**
 * Mounts the MCP authorization server endpoints (/.well-known/*, /authorize,
 * /token, /register, /revoke, /consent) on the app and returns a middleware
 * that enforces Bearer tokens on the MCP endpoint.
 */
export function installOAuth(app: Express, publicUrl: string): OAuthInstallResult {
  const issuerUrl = new URL(publicUrl);
  const resourceServerUrl = new URL(publicUrl);
  const store = new FileStore();
  const provider = new LocalOAuthProvider(store);
  const scopes = ["mcp:use"];

  const generousRate = { windowMs: 15 * 60 * 1000, max: 500 };

  app.use(
    mcpAuthRouter({
      provider,
      issuerUrl,
      resourceServerUrl,
      scopesSupported: scopes,
      resourceName: "Solvency Sentinel MCP",
      tokenOptions: { rateLimit: generousRate },
      authorizationOptions: { rateLimit: generousRate },
      clientRegistrationOptions: { rateLimit: { windowMs: 60 * 60 * 1000, max: 500 } },
      revocationOptions: { rateLimit: generousRate },
    })
  );

  const consentHandler: RequestHandler = async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, string | undefined>;
    const clientId = body.client_id;
    const redirectUri = body.redirect_uri;
    const codeChallenge = body.code_challenge;
    const state = body.state;
    const scope = body.scope ?? "";
    const resource = body.resource;
    if (!clientId || !redirectUri || !codeChallenge) {
      res.status(400).send("Missing authorization parameters");
      return;
    }
    const client = await provider.clientsStore.getClient(clientId);
    if (!client) {
      res.status(400).send("Unknown client_id");
      return;
    }
    if (!client.redirect_uris?.includes(redirectUri)) {
      res.status(400).send("Unregistered redirect_uri");
      return;
    }
    const code = provider.issueCode(
      clientId,
      codeChallenge,
      redirectUri,
      resource ? new URL(resource) : undefined,
      scope.split(" ").filter(Boolean)
    );
    const target = new URL(redirectUri);
    target.searchParams.set("code", code);
    if (state) target.searchParams.set("state", state);
    res.redirect(302, target.href);
  };
  app.use("/consent", consentHandler);

  const requireMcpAuth = requireBearerAuth({
    verifier: provider,
    requiredScopes: scopes,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceServerUrl),
  });

  return { requireMcpAuth, provider };
}
