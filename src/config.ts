import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function loadEnv(): void {
  const root = resolve(here, "..");
  for (const file of [resolve(root, ".env"), resolve(root, ".env.local")]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!m) continue;
    const key = m[1]!;
    const raw = m[2]!;
    if (process.env[key] === undefined) {
      process.env[key] = raw.replace(/^["']|["']$/g, "");
    }
    }
  }
}

loadEnv();

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export interface Config {
  apiKey: string;
  baseUrl: string;
  user: string;
  chainId: string;
  criticalHf: number;
  targetHf: number;
  intervalSeconds: number;
  confirm: boolean;
}

export function getConfig(): Config {
  const apiKey = process.env.KEEPERHUB_API_KEY ?? "";
  return {
    apiKey,
    baseUrl: process.env.KEEPERHUB_BASE_URL ?? "https://app.keeperhub.com",
    user: process.env.SENTINEL_USER ?? "",
    chainId: String(num("SENTINEL_CHAIN", 84532)),
    criticalHf: num("SENTINEL_CRITICAL_HF", 1.05),
    targetHf: num("SENTINEL_TARGET_HF", 1.5),
    intervalSeconds: num("SENTINEL_INTERVAL_SECONDS", 60),
    confirm: num("SENTINEL_CONFIRM", 1) === 1,
  };
}

export function requireApiKey(cfg: Config): string {
  if (!cfg.apiKey) {
    throw new Error(
      "KEEPERHUB_API_KEY is not set. Create an org API key at " +
        "app.keeperhub.com > Settings > API Keys > Organisation tab, then " +
        "copy .env.example to .env and fill it in."
    );
  }
  return cfg.apiKey;
}
