import { createHash } from "node:crypto";

export class IdempotencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdempotencyError";
  }
}

export function canonicalizeAmount(s: string): string {
  const t = s.trim();
  if (t === "") throw new IdempotencyError("amount cannot be empty");
  if (t.startsWith("+") || t.startsWith("-")) {
    throw new IdempotencyError(`amount must be unsigned, got "${s}"`);
  }
  if (/[eE]/.test(t)) throw new IdempotencyError(`amount must not use exponents, got "${s}"`);
  if (!/^\d+\.?\d*$/.test(t)) {
    throw new IdempotencyError(`amount must be a plain decimal, got "${s}"`);
  }
  const [intPartRaw, fracPartRaw] = t.split(".");
  const intPart = intPartRaw!;
  const int = intPart.replace(/^0+(?=\d)/, "") || "0";
  const fracPart = fracPartRaw ?? "";
  const frac = fracPart.replace(/0+$/, "");
  return frac === "" ? int : `${int}.${frac}`;
}

function canonicalizeTaskId(taskId: string): string {
  const t = taskId.trim();
  return t.replace(/%/g, "%25").replace(/\|/g, "%7C");
}

function canonicalizeAddress(a: string): string {
  return a.trim().toLowerCase();
}

function canonicalizeChain(chainId: string): string {
  const n = BigInt(chainId.trim());
  return n.toString();
}

function canonicalizeOptional(v: string | undefined | null): string {
  if (v === undefined || v === null) return "";
  const t = String(v).trim();
  return t;
}

export interface IdempotencyFields {
  taskId: string;
  chainId: string;
  address: string;
  amount?: string;
  extras?: Record<string, string | undefined | null>;
}

export function deriveIdempotencyKey(fields: IdempotencyFields): string {
  const extras = fields.extras ?? {};
  const parts = [
    canonicalizeTaskId(fields.taskId),
    canonicalizeChain(fields.chainId),
    canonicalizeAddress(fields.address),
    canonicalizeAmount(fields.amount ?? "0"),
  ];
  const extraKeys = Object.keys(extras).sort();
  for (const key of extraKeys) {
    parts.push(canonicalizeOptional(extras[key]));
  }
  const joined = parts.join("|");
  return createHash("sha256").update(joined, "utf8").digest("hex");
}

export function canonicalizeBodyForHash(body: Record<string, unknown>): string {
  const keys = Object.keys(body).sort();
  return JSON.stringify(keys.map((k) => [k, body[k]]));
}
