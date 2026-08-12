# Drive Solvency Sentinel from ChatGPT / Claude (MCP)

Solvency Sentinel ships as a Model Context Protocol (MCP) server. Register it
once in ChatGPT or Claude Desktop, then ask for a health check or a protect run
in plain language. Every action still executes on-chain through KeeperHub.

Proven live (Ethereum Sepolia, 2026-08-12 02:37 UTC): a `sentinel_monitor` call
over MCP stdio broadcast the Aave `repay` through KeeperHub and returned a
verified receipt — HF 1.320 → 43,737.57.
Tx: `0x7a757600f94835a0f8e6a1787ca936ff0047b83ca6b360becb540d269e9b23b7`.

## 1. Register the server

ChatGPT / Claude Desktop — add to the MCP servers config:

```json
{
  "mcpServers": {
    "solvency-sentinel": {
      "command": "node",
      "args": ["--import", "tsx/esm", "/ABS/PATH/keeperhub-solvency-sentinel/src/mcp.ts"],
      "env": {
        "KEEPERHUB_API_KEY": "kh_…",
        "SENTINEL_USER": "0x4856C80305bFb41ADD710eCA576368ec92221113",
        "SENTINEL_CHAIN": "11155111",
        "SENTINEL_CRITICAL_HF": "1.5"
      }
    }
  }
}
```

(Claude Code instead: `claude mcp add --transport stdio sentinel -- npm run mcp`
run inside the repo.)

## 2. Tools the model can call

| tool | purpose |
| --- | --- |
| `sentinel_check` | Read Aave V3 health factor + risk level. Read-only, never broadcasts. |
| `sentinel_monitor` | Full protect loop: read → evaluate → preflight simulate → idempotent broadcast → poll → verify → audit report. |
| `sentinel_status` | Fetch status + verified receipts of a KeeperHub execution id. |

`sentinel_monitor` arguments: `chainId`, `user`, `criticalHf`, `targetHf`,
`confirm` (default **false** — the model invoking the tool is the operator),
`dryRun`.

## 3. Example prompts

- "Check my Aave position on Sepolia." → `sentinel_check`
- "Protect the position — repay if the health factor drops below 1.5." → `sentinel_monitor`
- "Dry-run the protect loop first." → `sentinel_monitor` with `dryRun: true`
- "What happened to execution ojr4n9yyw35644mrppbf9?" → `sentinel_status`

## 4. What comes back

`sentinel_monitor` returns the full run report (position snapshot, decision,
each step, execution id, sponsored flag, verified receipts) and writes the
audit trail to `docs/runs/`. The agent never claims a rescue unless the
`verify-position` post-check shows the health factor actually recovered.
