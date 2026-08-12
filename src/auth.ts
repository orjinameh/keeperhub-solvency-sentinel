import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getStore } from "./db.ts";

const here = dirname(fileURLToPath(import.meta.url));

function loadSecretFromEnvOrFile(): string {
  const env = process.env.PORTAL_SECRET;
  if (env) return env;
  const path = resolve(here, "..", "data", ".portal-secret");
  try {
    if (existsSync(path)) return readFileSync(path, "utf8").trim();
  } catch {
    /* fall through */
  }
  const s = randomBytes(32).toString("hex");
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, s, "utf8");
  } catch (err) {
    console.error("[auth] cannot persist session secret:", err);
  }
  return s;
}

let SECRET = loadSecretFromEnvOrFile();

/**
 * Called once at server startup. When PORTAL_SECRET is not set, the secret is
 * mirrored into the store so it survives process restarts (e.g. Render free
 * tier cold starts) — keeping session cookies and encrypted credentials valid.
 */
export async function ensureSecretPersisted(): Promise<void> {
  if (process.env.PORTAL_SECRET) return;
  const store = await getStore();
  try {
    const stored = await store.getServerSecret();
    if (stored) {
      if (stored !== SECRET) SECRET = stored;
    } else {
      await store.setServerSecret(SECRET);
    }
  } catch (err) {
    console.error("[auth] could not persist session secret to store:", err);
  }
}

const SESSION_SECRET = () => SECRET;
const AES_KEY = () => scryptSync(SECRET, "solvency-sentinel-credential-key", 32);

export const SESSION_COOKIE = "sentinel_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface PasswordHash {
  salt: string;
  hash: string;
}

export function hashPassword(password: string): PasswordHash {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const hash = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, "hex");
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

export interface SessionPayload {
  uid: string;
  email: string;
}

export function signSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + SESSION_TTL_MS })).toString(
    "base64url"
  );
  const sig = createHmac("sha256", SESSION_SECRET()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const idx = token.indexOf(".");
  if (idx <= 0) return null;
  const body = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = createHmac("sha256", SESSION_SECRET()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      uid?: unknown;
      email?: unknown;
      exp?: unknown;
    };
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number" || payload.exp < Date.now()) {
      return null;
    }
    return { uid: payload.uid, email: typeof payload.email === "string" ? payload.email : "" };
  } catch {
    return null;
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", AES_KEY(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(enc: string): string {
  const parts = enc.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("Unsupported credential format");
  const [, ivHex, tagHex, dataHex] = parts;
  if (!ivHex || !tagHex || !dataHex) throw new Error("Corrupt credential");
  const decipher = createDecipheriv("aes-256-gcm", AES_KEY(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
}
