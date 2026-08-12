import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isAddress, recoverMessageAddress } from "viem";

const here = dirname(fileURLToPath(import.meta.url));
const positionsPath = resolve(here, "..", "data", "positions.json");

interface OwnedPosition {
  address: string;
  chainId: string;
  message: string;
  signature: string;
  registeredAt: number;
}

let positions: OwnedPosition[] = load();
let timer: ReturnType<typeof setTimeout> | undefined;

function load(): OwnedPosition[] {
  try {
    if (!existsSync(positionsPath)) return [];
    const parsed = JSON.parse(readFileSync(positionsPath, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(): void {
  if (timer) return;
  timer = setTimeout(() => {
    timer = undefined;
    try {
      mkdirSync(dirname(positionsPath), { recursive: true });
      const tmp = `${positionsPath}.tmp`;
      writeFileSync(tmp, JSON.stringify(positions), "utf8");
      renameSync(tmp, positionsPath);
    } catch (err) {
      console.error("[ownership] failed to persist:", err);
    }
  }, 200);
}

export interface RegisterResult {
  ok: boolean;
  error?: string;
}

/**
 * Proves control of an address via an EIP-191 personal_sign recovery and
 * records it so sentinel_monitor may broadcast rescues against it. The
 * signature IS the authorization — anyone can register any address, but only
 * the wallet that actually owns the address can produce a valid signature.
 */
export async function registerPosition(args: {
  chainId: string;
  address: string;
  message: string;
  signature: string;
}): Promise<RegisterResult> {
  if (!isAddress(args.address)) return { ok: false, error: `Invalid address: ${args.address}` };
  if (!args.message) return { ok: false, error: "Missing signing message" };
  if (!args.signature) return { ok: false, error: "Missing signature" };

  const signedBy = await recoverMessageAddress({
    message: args.message,
    signature: args.signature as `0x${string}`,
  }).catch(() => undefined);
  if (!signedBy || signedBy.toLowerCase() !== args.address.toLowerCase()) {
    return {
      ok: false,
      error: "Signature does not match the address. Sign the message with the wallet that owns the position.",
    };
  }

  positions = positions.filter(
    (p) => !(p.chainId === args.chainId && p.address.toLowerCase() === args.address.toLowerCase())
  );
  positions.push({
    address: args.address,
    chainId: args.chainId,
    message: args.message,
    signature: args.signature,
    registeredAt: Date.now(),
  });
  save();
  return { ok: true };
}

export function ownsPosition(chainId: string, address: string): boolean {
  return positions.some(
    (p) => p.chainId === chainId && p.address.toLowerCase() === address.toLowerCase()
  );
}

export function ownedPositions(): Array<{ address: string; chainId: string; registeredAt: number }> {
  return positions.map((p) => ({ address: p.address, chainId: p.chainId, registeredAt: p.registeredAt }));
}
