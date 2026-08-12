import { decodeAbiParameters, createPublicClient, fallback, http } from "viem";
import {
  arbitrum,
  base,
  baseSepolia,
  mainnet,
  polygon,
  sepolia,
  type Chain as ViemChain,
} from "viem/chains";
import { simulateContractCall } from "../keeperhub/client.ts";
import type { AaveChain } from "./chains.ts";
import { DATA_PROVIDER_ABI, ERC20_ABI, POOL_ABI } from "./abi.ts";

const VIEM_CHAINS: Record<string, ViemChain> = {
  "1": mainnet,
  "137": polygon,
  "8453": base,
  "84532": baseSepolia,
  "42161": arbitrum,
  "11155111": sepolia,
};

const clients = new Map<string, ReturnType<typeof createPublicClient>>();

function publicClient(chain: AaveChain) {
  let client = clients.get(chain.chainId);
  if (!client) {
    const transport = fallback(
      [http(chain.rpc), http(chain.rpcFallback)],
      { retryCount: 1 }
    );
    client = createPublicClient({ chain: VIEM_CHAINS[chain.chainId], transport });
    clients.set(chain.chainId, client);
  }
  return client;
}

export interface AccountData {
  user: string;
  chain: AaveChain;
  totalCollateralBase: bigint;
  totalDebtBase: bigint;
  availableBorrowsBase: bigint;
  currentLiquidationThreshold: bigint;
  ltv: bigint;
  healthFactor: bigint;
  healthFactorNumber: number;
}

export interface ReserveData {
  asset: string;
  currentATokenBalance: bigint;
  currentStableDebt: bigint;
  currentVariableDebt: bigint;
}

export function decodeResult<T extends readonly unknown[]>(result: unknown, outputs: readonly unknown[]): T {
  const outNames = (outputs as readonly { name?: string }[]).map((o) => o.name);
  if (typeof result === "string") {
    if (/^0x/i.test(result)) {
      return decodeAbiParameters(outputs as any, result as `0x${string}`) as T;
    }
    if (/^\d+$/.test(result.trim())) {
      return [BigInt(result.trim())] as unknown as T;
    }
  }
  if (Array.isArray(result)) {
    return result as unknown as T;
  }
  if (typeof result === "object" && result !== null) {
    const named = result as Record<string, unknown>;
    const names = outNames.filter((n): n is string => !!n);
    if (names.length > 0 && names.every((n) => n in named)) {
      return names.map((n) => named[n]) as unknown as T;
    }
    return result as unknown as T;
  }
  throw new Error(`Cannot decode contract call result: ${JSON.stringify(result)}`);
}

export async function readAccountData(chain: AaveChain, user: string): Promise<AccountData> {
  const client = publicClient(chain);
  const [totalCollateralBase, totalDebtBase, availableBorrowsBase, currentLiquidationThreshold, ltv, healthFactor] =
    await client.readContract({
      address: chain.pool as `0x${string}`,
      abi: POOL_ABI,
      functionName: "getUserAccountData",
      args: [user as `0x${string}`],
    });
  return {
    user,
    chain,
    totalCollateralBase,
    totalDebtBase,
    availableBorrowsBase,
    currentLiquidationThreshold,
    ltv,
    healthFactor,
    healthFactorNumber: Number(healthFactor) / 1e18,
  };
}

export async function readReservesList(chain: AaveChain): Promise<string[]> {
  const client = publicClient(chain);
  const reserves = await client.readContract({
    address: chain.pool as `0x${string}`,
    abi: POOL_ABI,
    functionName: "getReservesList",
  });
  return Array.from(reserves);
}

export async function readReserveData(chain: AaveChain, asset: string, user: string): Promise<ReserveData> {
  const client = publicClient(chain);
  const [currentATokenBalance, currentStableDebt, currentVariableDebt] = await client.readContract({
    address: chain.dataProvider as `0x${string}`,
    abi: DATA_PROVIDER_ABI,
    functionName: "getUserReserveData",
    args: [asset as `0x${string}`, user as `0x${string}`],
  });
  return { asset, currentATokenBalance, currentStableDebt, currentVariableDebt };
}

export interface BorrowPosition {
  asset: string;
  stableDebt: bigint;
  variableDebt: bigint;
}

export async function findBorrows(chain: AaveChain, user: string): Promise<BorrowPosition[]> {
  const reserves = await readReservesList(chain);
  const positions: BorrowPosition[] = [];
  for (const asset of reserves) {
    const data = await readReserveData(chain, asset, user);
    if (data.currentStableDebt > 0n || data.currentVariableDebt > 0n) {
      positions.push({ asset, stableDebt: data.currentStableDebt, variableDebt: data.currentVariableDebt });
    }
  }
  return positions;
}

export async function readTokenBalance(chain: AaveChain, token: string, holder: string): Promise<bigint> {
  const client = publicClient(chain);
  return client.readContract({
    address: token as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [holder as `0x${string}`],
  });
}

export async function readTokenAllowance(chain: AaveChain, token: string, owner: string, spender: string): Promise<bigint> {
  const client = publicClient(chain);
  return client.readContract({
    address: token as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner as `0x${string}`, spender as `0x${string}`],
  });
}

export async function readTokenDecimals(chain: AaveChain, token: string): Promise<number> {
  const client = publicClient(chain);
  const decimals = await client.readContract({
    address: token as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "decimals",
  });
  return Number(decimals);
}

export { simulateContractCall };
