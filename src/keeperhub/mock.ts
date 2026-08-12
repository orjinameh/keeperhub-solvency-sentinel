import type { KeeperHubOps } from "../sentinel.ts";
import { getAaveChain } from "../aave/chains.ts";
import type { AccountData } from "../aave/position.ts";
import { MAX_UINT256 } from "../aave/abi.ts";

const FAKE_USER = "0x1234567890abcdef1234567890abcdef12345678";

export interface DryRunScenario {
  healthFactor?: number;
  collateralUsd?: number;
  debtUsd?: number;
  debtAsset?: string;
  executionId?: string;
}

export function dryRunOps(scenario: DryRunScenario = {}): KeeperHubOps {
  const hf = scenario.healthFactor ?? 1.02;
  const collateralUsd = scenario.collateralUsd ?? 1000;
  const debtUsd = scenario.debtUsd ?? 800;
  const debtAsset = scenario.debtAsset ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  const chain = getAaveChain("84532");

  const fakeAccount = (user: string): AccountData => {
    const account = {
      user,
      chain,
      totalCollateralBase: BigInt(Math.round(collateralUsd * 1e8)),
      totalDebtBase: BigInt(Math.round(debtUsd * 1e8)),
      availableBorrowsBase: 0n,
      currentLiquidationThreshold: 8000n,
      ltv: 7500n,
      healthFactor: BigInt(Math.round(hf * 1e18)),
      healthFactorNumber: hf,
    };
    return account;
  };

  return {
    async readAccountData(_chain, user) {
      return fakeAccount(user);
    },
    async findBorrows() {
      return [
        { asset: debtAsset, stableDebt: 0n, variableDebt: BigInt(Math.round(debtUsd * 1e6)) },
      ];
    },
    async readTokenBalance() {
      return BigInt(Math.round(debtUsd * 1e6));
    },
    async readTokenAllowance() {
      return BigInt(Math.round(debtUsd * 1e6));
    },
    async simulateContractCall(req) {
      return {
        success: true,
        status: "simulated",
        gasEstimate: "186000",
        from: FAKE_USER,
        to: req.contractAddress,
        value: "0",
        simulatedReturnValue: "618000000000000000000",
        wouldRevert: false,
      };
    },
    async executeContractCall(_req, taskId) {
      return {
        executionId: scenario.executionId ?? `direct_dry_${Math.floor(Math.random() * 1e6)}`,
        status: "completed",
        transactionHash: `0x${"d".repeat(64)}`,
        transactionLink: "https://sepolia.basescan.org/tx/0x" + "d".repeat(64),
        idempotentReplay: false,
        taskId,
      };
    },
    async pollUntilTerminal(id) {
      return {
        executionId: id,
        status: "completed",
        type: "contract-call",
        transactionHash: "0x" + "d".repeat(64),
        transactionLink: "https://sepolia.basescan.org/tx/0x" + "d".repeat(64),
        sponsored: false,
        receipts: [
          {
            hash: "0x" + "d".repeat(64),
            chainId: 84532,
            verified: true,
            receiptStatus: "success",
            blockNumber: 9999999,
            gasUsed: "186000",
            verifiedAt: new Date().toISOString(),
          },
        ],
      };
    },
  };
}
