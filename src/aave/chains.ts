export interface AaveChain {
  chainId: string;
  name: string;
  testnet: boolean;
  pool: string;
  addressesProvider: string;
  dataProvider: string;
  explorer: string;
}

export const AAVE_CHAINS: Record<string, AaveChain> = {
  "84532": {
    chainId: "84532",
    name: "Base Sepolia",
    testnet: true,
    pool: "0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27",
    addressesProvider: "0xE4C23309117Aa30342BFaae6c95c6478e0A4Ad00",
    dataProvider: "0xBc9f5b7E248451CdD7cA54e717a2BFe1F32b566b",
    explorer: "https://sepolia.basescan.org",
  },
  "11155111": {
    chainId: "11155111",
    name: "Ethereum Sepolia",
    testnet: true,
    pool: "0xE7EC1B0015eb2ADEedb1B7f9F1Ce82F9DAD6dF08",
    addressesProvider: "0x0496275d34753A48320CA58103d5220d394FF77F",
    dataProvider: "0x5C5228aC8BC1528482514aF3e27E692495148717",
    explorer: "https://sepolia.etherscan.io",
  },
  "8453": {
    chainId: "8453",
    name: "Base",
    testnet: false,
    pool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    addressesProvider: "0xe20fCBdBfFC4Dd138cE8b2E6FBb6Cb49777ad64D",
    dataProvider: "0x2d8A3C5677189723C4cB8873CfC9C8976FDF38Ac",
    explorer: "https://basescan.org",
  },
  "42161": {
    chainId: "42161",
    name: "Arbitrum One",
    testnet: false,
    pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    addressesProvider: "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb",
    dataProvider: "0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654",
    explorer: "https://arbiscan.io",
  },
  "137": {
    chainId: "137",
    name: "Polygon",
    testnet: false,
    pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    addressesProvider: "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb",
    dataProvider: "0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654",
    explorer: "https://polygonscan.com",
  },
  "1": {
    chainId: "1",
    name: "Ethereum",
    testnet: false,
    pool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    addressesProvider: "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e",
    dataProvider: "0x41393e5e337606dc3821075Af65AeE84D7688CBD",
    explorer: "https://etherscan.io",
  },
};

export function getAaveChain(chainId: string): AaveChain {
  const chain = AAVE_CHAINS[chainId];
  if (!chain) {
    throw new Error(
      `Unsupported chain ${chainId}. Supported: ${Object.keys(AAVE_CHAINS).join(", ")}`
    );
  }
  return chain;
}
