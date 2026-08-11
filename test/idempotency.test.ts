import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalizeAmount, deriveIdempotencyKey } from "../src/keeperhub/idempotency.ts";

test("canonicalizeAmount applies the decimal rules", () => {
  assert.equal(canonicalizeAmount(" 0.1 "), "0.1");
  assert.equal(canonicalizeAmount("1.000"), "1");
  assert.equal(canonicalizeAmount("0.0010"), "0.001");
  assert.equal(canonicalizeAmount("007"), "7");
  assert.equal(canonicalizeAmount("01.5"), "1.5");
  assert.equal(canonicalizeAmount("0.0"), "0");
  assert.equal(canonicalizeAmount("0"), "0");
  assert.equal(canonicalizeAmount("1000000000000000000"), "1000000000000000000");
  assert.throws(() => canonicalizeAmount("0.1e18"), /exponent/);
  assert.throws(() => canonicalizeAmount("+.5"), /unsigned/);
  assert.throws(() => canonicalizeAmount(".5"), /plain decimal/);
});

test("identical work derives identical idempotency keys", () => {
  const a = deriveIdempotencyKey({
    taskId: "nightly-sweep-2026-08-06",
    chainId: "84532",
    address: "0xABcD",
    amount: "0.10",
  });
  const b = deriveIdempotencyKey({
    taskId: "nightly-sweep-2026-08-06",
    chainId: "84532",
    address: "0xabcd",
    amount: "0.1",
  });
  assert.equal(a, b);
});

test("different task buckets derive different keys", () => {
  const a = deriveIdempotencyKey({ taskId: "nightly-sweep-2026-08-06", chainId: "84532", address: "0xabcd", amount: "0.1" });
  const b = deriveIdempotencyKey({ taskId: "nightly-sweep-2026-08-07", chainId: "84532", address: "0xabcd", amount: "0.1" });
  assert.notEqual(a, b);
});

test("chain id spellings agree (base / 8453)", () => {
  const a = deriveIdempotencyKey({ taskId: "t1", chainId: "8453", address: "0xabcd", amount: "1" });
  const b = deriveIdempotencyKey({ taskId: "t1", chainId: "8453", address: "0xabcd", amount: "1.0" });
  assert.equal(a, b);
});

test("a pipe in the taskId never breaks key derivation", () => {
  const key = deriveIdempotencyKey({ taskId: "8453|0xabc", chainId: "1", address: "0x1", amount: "1" });
  assert.match(key, /^[0-9a-f]{64}$/);
  const bare = deriveIdempotencyKey({ taskId: "8453", chainId: "1", address: "0x1", amount: "1" });
  assert.notEqual(key, bare);
});

test("extras are order-independent", () => {
  const a = deriveIdempotencyKey({ taskId: "t1", chainId: "1", address: "0x1", amount: "0", extras: { fn: "repay", args: "x" } });
  const b = deriveIdempotencyKey({ taskId: "t1", chainId: "1", address: "0x1", amount: "0", extras: { args: "x", fn: "repay" } });
  assert.equal(a, b);
});

test("key is lowercase sha256 hex (64 chars)", () => {
  const key = deriveIdempotencyKey({ taskId: "t1", chainId: "1", address: "0x1", amount: "1" });
  assert.match(key, /^[0-9a-f]{64}$/);
});
