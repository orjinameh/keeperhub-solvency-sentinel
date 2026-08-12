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
import { parseCookies, SESSION_COOKIE, verifySession, type SessionPayload } from "./auth.ts";

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
    const session = res.locals.sentinelUser as SessionPayload | null;
    res.status(200).send(consentPage(client.client_id, params, session));
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

function consentPage(clientId: string, params: AuthorizationParams, session: SessionPayload | null): string {
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
  const email = session?.email ?? "";
  const loggedIn = !!email;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Connect ChatGPT to Solvency Sentinel</title>
<style>
:root{--bg:#05070d;--card:#0b0f1a;--line:rgba(255,255,255,.08);--txt:#e8edf7;--mut:#8b94a7;--acc:#34d399;--red:#f43f5e}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--txt);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.55;display:grid;place-items:center;min-height:100vh;padding:40px 20px;-webkit-font-smoothing:antialiased}
.card{width:100%;max-width:420px;border:1px solid var(--line);border-radius:18px;background:var(--card);padding:32px}
.logo{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#34d399,#a3e635);display:grid;place-items:center;color:#05110a;font-size:22px;font-weight:900;margin-bottom:16px}
h1{font-size:20px;font-weight:800;letter-spacing:-.01em}
p{color:var(--mut);font-size:13.5px;margin:8px 0 20px}
code{background:#111827;padding:.1rem .35rem;border-radius:.3rem;font-size:.85em;color:#e8edf7}
label{display:block;font-size:12.5px;color:var(--mut);margin:14px 0 6px}
input{width:100%;background:#0e1424;border:1px solid var(--line);color:var(--txt);border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none}
input:focus{border-color:var(--acc)}
button{margin-top:18px;width:100%;background:var(--acc);color:#05110a;font-weight:700;border:0;padding:11px;border-radius:10px;font-size:14.5px;cursor:pointer;font-family:inherit}
button.ghost{background:transparent;border:1px solid var(--line);color:var(--mut);margin-top:10px}
.switch{text-align:center;margin-top:14px;font-size:13px;color:var(--mut)}
.switch a{color:var(--acc);cursor:pointer;text-decoration:none}
.err{color:var(--red);font-size:13px;min-height:1em;margin-top:10px}
.ok{color:var(--acc);font-size:13px;min-height:1em;margin-top:10px}
.gbtn{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:transparent;color:var(--txt);font-weight:600;font-size:14px;text-decoration:none;cursor:pointer;font-family:inherit;margin-bottom:0}
.gbtn:hover{border-color:var(--acc)}
.gbtn svg{flex:none}
.divider{display:flex;align-items:center;gap:12px;color:var(--mut);font-size:12.5px;margin:16px 0 4px}
.divider::before,.divider::after{content:"";flex:1;height:1px;background:var(--line)}
</style></head><body>
<div class="card">
  <div class="logo">S</div>
  <h1>Connect an AI agent</h1>
  <p>A client (<code>${esc(clientId)}</code>) is requesting access to your Solvency Sentinel MCP server so it can read your protected positions and execute rescue repayments — each broadcast is held for your approval in the Control Room.</p>

  <div id="authBox"${loggedIn ? ' style="display:none"' : ""}>
    <div id="msg" class="err"></div>
    <a class="gbtn" id="googleBtn" href="/api/portal/auth/google"><svg width="17" height="17" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg><span>Continue with Google</span></a>
    <div class="divider">or continue with email</div>
    <form id="loginForm">
      <label>Email</label><input id="loginEmail" type="email" autocomplete="email" required>
      <label>Password</label><input id="loginPassword" type="password" autocomplete="current-password" required>
      <button type="submit">Sign in &amp; authorize</button>
    </form>
    <form id="regForm" style="display:none">
      <label>Email</label><input id="regEmail" type="email" autocomplete="email" required>
      <label>Password (min 8 chars)</label><input id="regPassword" type="password" minlength="8" autocomplete="new-password" required>
      <button type="submit">Create account &amp; authorize</button>
    </form>
    <div class="switch" id="authSwitch">New here? <a id="showReg">Create an account</a></div>
  </div>

  <div id="consentBox"${loggedIn ? "" : ' style="display:none"'}">
    <div class="ok" id="signedIn">${loggedIn ? "Signed in as <b>" + esc(email) + "</b>" : ""}</div>
    <div id="walletStep">
      <p style="margin:10px 0 4px">Connect the wallet that owns your positions &mdash; the agent will only check and rescue its verified positions.</p>
      <button type="button" id="walletBtn">Connect wallet</button>
      <div class="ok" id="walletInfo"></div>
      <div class="err" id="walletErr"></div>
    </div>
    <p style="margin-top:6px">Only your verified positions can be checked or rescued &mdash; every other address is refused.</p>
    <form action="/consent" method="post" id="consentForm">
${inputs}
      <button type="submit" id="authorizeBtn" disabled>Authorize</button>
    </form>
    <div class="switch"><a id="skipWallet">Continue without connecting a wallet</a></div>
  </div>
</div>
<script>
var loggedIn=${loggedIn ? "true" : "false"};
function $(id){return document.getElementById(id)}
$("googleBtn").href="/api/portal/auth/google?return_to="+encodeURIComponent(location.href);
fetch("/api/portal/auth/status").then(function(r){return r.json()}).then(function(d){if(!(d&&d.googleConfigured))$("googleBtn").style.display="none"}).catch(function(){});

function msg(t,ok){var m=$("msg");m.className=ok?"ok":"err";m.textContent=t}
function showConsent(email){
  $("authBox").style.display="none";
  $("consentBox").style.display="block";
  $("signedIn").innerHTML="Signed in as <b>"+email.replace(/[<>&]/g,"")+"</b>";
  initWallet();
}
function enableAuthorize(){$("authorizeBtn").disabled=false}
function initWallet(){
  if(!(window.ethereum&&window.ethereum.request)){
    $("walletBtn").style.display="none";
    $("walletErr").textContent="No browser wallet detected (e.g. MetaMask). You can continue — connect later in the Control Room.";
    enableAuthorize();
  }
}
$("walletBtn").addEventListener("click",function(){
  if(!(window.ethereum&&window.ethereum.request))return;
  $("walletErr").textContent="";
  window.ethereum.request({method:"eth_requestAccounts"}).then(function(accs){
    return window.ethereum.request({method:"eth_chainId"}).then(function(cid){
      $("walletBtn").style.display="none";
      $("walletInfo").textContent="Connected: "+accs[0].toLowerCase()+" (network "+parseInt(cid,16)+")";
      enableAuthorize();
    });
  }).catch(function(e){$("walletErr").textContent="Connection failed or cancelled: "+(e.message||String(e))});
});
$("skipWallet").addEventListener("click",function(e){e.preventDefault();$("walletStep").style.display="none";enableAuthorize()});
function submit(path,email,pw){
  return fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:email,password:pw})}).then(function(r){return r.json()}).then(function(d){
    if(d.ok){showConsent(email);return}
    msg(d.error||"Authentication failed.",false);
  }).catch(function(e){msg(e.message,false)});
}
$("loginForm").addEventListener("submit",function(e){e.preventDefault();submit("/api/portal/login",$("loginEmail").value.trim(),$("loginPassword").value)});
$("regForm").addEventListener("submit",function(e){e.preventDefault();submit("/api/portal/register",$("regEmail").value.trim(),$("regPassword").value)});
$("showReg").addEventListener("click",function(){
  $("loginForm").style.display="none";$("regForm").style.display="block";
  $("authSwitch").innerHTML='Have an account? <a id="showLogin">Sign in</a>';
  $("showLogin").addEventListener("click",function(){
    $("regForm").style.display="none";$("loginForm").style.display="block";
    $("authSwitch").innerHTML='New here? <a id="showReg">Create an account</a>';
  });
});
</script>
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

  const attachSession: RequestHandler = (req: Request, res: Response, next) => {
    const cookies = parseCookies(req.headers.cookie);
    res.locals.sentinelUser = verifySession(cookies[SESSION_COOKIE]);
    next();
  };
  app.use(attachSession);

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
