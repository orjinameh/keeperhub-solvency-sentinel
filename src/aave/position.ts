import { decodeAbiParameters } from "viem";
import { executeContractCall, simulateContractCall } from "../keeperhub/client.ts";
import type { AaveChain } from "./chains.ts";
import { ERC20_ABI, POOL_ABI } from "./abi.ts";

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
  liquidityRate: bigint;
  stableRate: bigint;
  variableRate: bigint;
}

export function decodeResult<T extends readonly unknown[]>(result: unknown, outputs: readonly unknown[]): T {
  if (typeof result === "string" && /^0x/i.test(result)) {
    return decodeAbiParameters(outputs as any, result as `0x${string}`) as T;
  }
  if (Array.isArray(result)) {
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
    contractAddress: chain.pool,
    functionName: "getUserReserveData",
    functionArgs: JSON.stringify([asset, user]),
    abi: POOL_ABI,
  });
  const [currentATokenBalance, currentStableDebt, currentVariableDebt, liquidityRate, stableRate, variableRate] =
    decodeResult<[bigint, bigint, bigint, bigint, bigint, bigint]>(result.result, POOL_ABI[1].outputs);
  return { asset, currentATokenBalance, currentStableDebt, currentVariableDebt, liquidityRate, stableRate, variableRate };
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
