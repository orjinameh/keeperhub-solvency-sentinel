import { isAddress, recoverMessageAddress } from "viem";
import { getStore } from "./db.ts";

export interface RegisterResult {
  ok: boolean;
  error?: string;
}

export interface RegisterArgs {
  chainId: string;
  address: string;
  message: string;
  signature: string;
  ownerId?: string;
}

/**
 * Proves control of an address via an EIP-191 personal_sign recovery and
 * records it so sentinel_monitor may broadcast rescues against it. The
 * signature IS the authorization — anyone can register any address, but only
 * the wallet that actually owns the address can produce a valid signature.
 * Ownership is stored wallet-wide (chainId "*") — one signature verifies the
 * wallet's positions on every supported chain, so the claim never drifts out
 * of sync with the chain an agent happens to check.
 */
export async function registerPosition(args: RegisterArgs): Promise<RegisterResult> {
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

  const store = await getStore();
  await store.addPosition({
    address: args.address,
    chainId: "*",
    message: args.message,
    signature: args.signature,
    registeredAt: Date.now(),
    ownerId: args.ownerId,
  });
  return { ok: true };
}

export async function ownsPosition(chainId: string, address: string): Promise<boolean> {
  return (await getStore()).ownsPosition(chainId, address);
}

export async function ownedPositions(): Promise<Array<{ address: string; chainId: string; registeredAt: number }>> {
  const positions = await (await getStore()).ownedPositions();
  return positions.map((p) => ({ address: p.address, chainId: p.chainId, registeredAt: p.registeredAt }));
}
