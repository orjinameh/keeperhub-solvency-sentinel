# Example requests against the KeeperHub Direct Execution API

All endpoints: `https://app.keeperhub.com`, auth `Authorization: Bearer kh_...`,
broadcasts must include `Idempotency-Key`. See
`https://docs.keeperhub.com/api/direct-execution`.

## 1. Simulate first (never signs or broadcasts)

```bash
curl -sS https://app.keeperhub.com/api/execute/contract-call \
  -H "Authorization: Bearer kh_..." \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": 84532,
    "contractAddress": "0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27",
    "functionName": "repay",
    "functionArgs": "[\"0x036CbD53842c5426634e7929541eC2318f3dCF7e\",\"115792089237316195423570985008687907853269984665640564039457584007913129639935\",2,\"0x742d35cc6634c0532925a3b844bc454e4438f44e\"]",
    "abi": "[{\"inputs\":[{\"internalType\":\"address\",\"name\":\"asset\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"amount\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"interestRateMode\",\"type\":\"uint256\"},{\"internalType\":\"address\",\"name\":\"onBehalfOf\",\"type\":\"address\"}],\"name\":\"repay\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"}]",
    "simulate": true
  }'
```

Continue only when the response has `"success": true` and `"wouldRevert": false`.

## 2. Broadcast once, with a derived idempotency key

```bash
curl -sS https://app.keeperhub.com/api/execute/contract-call \
  -H "Authorization: Bearer kh_..." \
  -H "Idempotency-Key: <sha256 of taskId|chainId|address|amount|effect-fields>" \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": 84532,
    "contractAddress": "0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27",
    "functionName": "repay",
    "functionArgs": "[\"0x036CbD53842c5426634e7929541eC2318f3dCF7e\",\"115792089237316195423570985008687907853269984665640564039457584007913129639935\",2,\"0x742d35cc6634c0532925a3b844bc454e4438f44e\"]",
    "abi": "[{...}]"
  }'
```

## 3. Poll status; receipts are the authoritative on-chain proof

```bash
curl -sS https://app.keeperhub.com/api/execute/direct_123/status \
  -H "Authorization: Bearer kh_..."
```

Honor the `X-Poll-Interval-Hint` header between polls; stop when status is
`completed` or `failed`.

## 4. Atomic path — check-and-execute (one call, no agent loop)

```bash
curl -sS https://app.keeperhub.com/api/execute/check-and-execute \
  -H "Authorization: Bearer kh_..." \
  -H "Content-Type: application/json" \
  -d '{
    "contractAddress": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "chainId": 84532,
    "functionName": "balanceOf",
    "functionArgs": "[\"0x742d35cc6634c0532925a3b844bc454e4438f44e\"]",
    "abi": "[{...}]",
    "condition": { "operator": "lt", "value": "1000000000" },
    "action": {
      "contractAddress": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "functionName": "transfer",
      "functionArgs": "[\"0x742d35cc6634c0532925a3b844bc454e4438f44e\",\"5000000000000000\"]",
      "abi": "[{...}]"
    }
  }'
```

## The safe first-write sequence, from the KeeperHub docs

1. `GET /api/chains` and choose a chain where `isEnabled` and `isTestnet` are true.
2. Send the intended request with `simulate: true`; continue only when the
   response has `success: true` and `wouldRevert: false`.
3. Remove `simulate`, add an `Idempotency-Key`, send once.
4. Save `executionId`, poll `GET /api/execute/{id}/status`, honor
   `X-Poll-Interval-Hint`, and treat the status response's receipts as the
   authoritative proof (`verified` + `receiptStatus: success`).
