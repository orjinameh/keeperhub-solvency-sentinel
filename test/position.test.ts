import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeAbiParameters } from "viem";
import { decodeResult } from "../src/aave/position.ts";
import { POOL_ABI } from "../src/aave/abi.ts";

const outputs = POOL_ABI[0].outputs as unknown as readonly { type: string; name: string }[];

test("decodeResult decodes hex abi-encoded tuple from KeeperHub read", () => {
  const values = [100000000000n, 50000000000n, 0n, 8000n, 7500n, 1300000000000000000n];
  const hex = encodeAbiParameters(
    outputs.map((o) => ({ type: o.type })),
    values
  );
  const [collateral, debt, borrow, lt, ltv, hf] = decodeResult<bigint[]>(hex, outputs);
  assert.equal(collateral, 100000000000n);
  assert.equal(debt, 50000000000n);
  assert.equal(hf, 1300000000000000000n);
  assert.equal(lt, 8000n);
});

test("decodeResult passes through a JSON array result untouched", () => {
  const [a, b] = decodeResult<[string, string]>(["42", "7"], outputs);
  assert.equal(a, "42");
  assert.equal(b, "7");
});

test("decodeResult throws on a garbage result", () => {
  assert.throws(() => decodeResult(42, outputs), /Cannot decode/);
});

test("POOL_ABI is a well-formed function abi", () => {
  assert.equal(POOL_ABI[0].name, "getUserAccountData");
  assert.equal(POOL_ABI[0].outputs.length, 6);
  assert.equal(POOL_ABI[3].name, "repay");
  assert.equal(POOL_ABI[3].inputs.length, 4);
});
