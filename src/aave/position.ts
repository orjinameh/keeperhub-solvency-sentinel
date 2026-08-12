import { decodeAbiParameters } from "viem";
import { executeContractCall, simulateContractCall } from "../keeperhub/client.ts";
import type { AaveChain } from "./chains.ts";
import { DATA_PROVIDER_ABI, ERC20_ABI, POOL_ABI } from "./abi.ts";

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
  const result = await executeContractCall({
    chainId: chain.chainId,
    contractAddress: chain.pool,
    functionName: "getUserAccountData",
    functionArgs: JSON.stringify([user]),
    abi: POOL_ABI,
  });
  const [totalCollateralBase, totalDebtBase, availableBorrowsBase, currentLiquidationThreshold, ltv, healthFactor] =
    decodeResult<[bigint, bigint, bigint, bigint, bigint, bigint]>(result.result, POOL_ABI[0].outputs);
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
  const result = await executeContractCall({
    chainId: chain.chainId,
    contractAddress: chain.pool,
    functionName: "getReservesList",
    abi: POOL_ABI,
  });
  return decodeResult<string[]>(result.result, POOL_ABI[2].outputs);
}

export async function readReserveData(chain: AaveChain, asset: string, user: string): Promise<ReserveData> {
  const result = await executeContractCall({
    chainId: chain.chainId,
    contractAddress: chain.dataProvider,
    functionName: "getUserReserveData",
    functionArgs: JSON.stringify([asset, user]),
    abi: DATA_PROVIDER_ABI,
  });
  const named = result.result as Record<string, string | undefined>;
  const field = (name: string): bigint => BigInt(named[name] ?? "0");
  return {
    asset,
    currentATokenBalance: field("currentATokenBalance"),
    currentStableDebt: field("currentStableDebt"),
    currentVariableDebt: field("currentVariableDebt"),
  };
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
  const result = await executeContractCall({
    chainId: chain.chainId,
    contractAddress: token,
    functionName: "balanceOf",
    functionArgs: JSON.stringify([holder]),
    abi: ERC20_ABI,
  });
  const [balance] = decodeResult<[bigint]>(result.result, ERC20_ABI[0].outputs);
  return balance;
}

export async function readTokenAllowance(chain: AaveChain, token: string, owner: string, spender: string): Promise<bigint> {
  const result = await executeContractCall({
    chainId: chain.chainId,
    contractAddress: token,
    functionName: "allowance",
    functionArgs: JSON.stringify([owner, spender]),
    abi: ERC20_ABI,
  });
  const [allowance] = decodeResult<[bigint]>(result.result, ERC20_ABI[4].outputs);
  return allowance;
}

export async function readTokenDecimals(chain: AaveChain, token: string): Promise<number> {
  const result = await executeContractCall({
    chainId: chain.chainId,
    contractAddress: token,
    functionName: "decimals",
    abi: ERC20_ABI,
  });
  const [decimals] = decodeResult<[number]>(result.result, [ERC20_ABI[2].outputs[0]!]);
  return Number(decimals);
}

export { simulateContractCall };
