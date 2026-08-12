import { getConfig } from "../src/config.ts";
import { POOL_WRITE_ABI } from "../src/aave/abi.ts";
import { simulateContractCall } from "../src/keeperhub/client.ts";

const POOL = "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951";

const MINT_ABI = [
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const RESERVES: Array<{ name: string; addr: string; decimals: number }> = [
  { name: "DAI", addr: "0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357", decimals: 18 },
  { name: "LINK", addr: "0xf8Fb3713D459D7C1018BD0A49D19b4C44290EBE5", decimals: 18 },
  { name: "USDC", addr: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8", decimals: 6 },
  { name: "WBTC", addr: "0x29f2D40B0605204364af54EC677bD022dA425d03", decimals: 8 },
  { name: "WETH", addr: "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c", decimals: 18 },
  { name: "USDT", addr: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0", decimals: 6 },
  { name: "AAVE", addr: "0x88541670E55cC00bEEFD87eB59EDd1b7C511AC9a", decimals: 18 },
  { name: "EURS", addr: "0x6d906e526a4e2Ca02097BA9d0caA3c382F52278E", decimals: 2 },
  { name: "GHO", addr: "0xc4bF5CbDaBE595361438F8c6a187bDc330539c60", decimals: 18 },
];

const cfg = getConfig();
if (!cfg.apiKey || !cfg.user) throw new Error("set KEEPERHUB_API_KEY and SENTINEL_USER in .env");

const probeAmount = (decimals: number) =>
  decimals === 6 ? "1000000" : decimals === 8 ? "1000000" : decimals === 2 ? "100" : "1000000000000000";

for (const r of RESERVES) {
  const amount = probeAmount(r.decimals);

  let borrow: string = "n/a";
  try {
    const b = await simulateContractCall({
      chainId: "11155111",
      contractAddress: POOL,
      functionName: "borrow",
      functionArgs: JSON.stringify([r.addr, amount, 2, 0, cfg.user]),
      abi: POOL_WRITE_ABI,
    });
    borrow = b.success === true ? "BORROWABLE" : `no (${b.revertReason ?? b.error ?? "?"})`;
  } catch (e) {
    borrow = `no (${(e as Error).message.slice(0, 120)})`;
  }

  console.log(`${r.name.padEnd(5)} ${r.addr}  borrow=${borrow}`);
}
