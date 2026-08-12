# Demo video — what you actually do

## What this video is

A **60–90 second screen recording** of your terminal that shows the agent doing a
REAL on-chain rescue. Judges watch it to confirm "yes, this agent really moves
money on-chain through KeeperHub."

It is NOT a production video. No editing skill, no mic required. You are just
screen-recording a terminal while a few commands run.

Judges only see the video if you upload/link it in the DoraHacks BUIDL form.
This file is only your script — judges never see it.

## Total time needed: ~15 minutes

1. Install a screen recorder (2 min)
2. Run the recording commands (5 min)
3. Save the file + upload (5 min)

## Step 1 — get a screen recorder

Already have OBS, or macOS QuickTime (free), or Windows Xbox Game Bar? Use that.
No preference: QuickTime (Mac: open app → File → New Screen Recording) or OBS
are the easiest. Record **your screen**, not the camera.

## Step 2 — record this (exactly these 5 commands, in order)

Open a terminal in the project folder (`keeperhub-solvency-sentinel`). Start
recording, then run:

```
# 1. show current state
npm run check -- --chain 11155111 --user 0x4856C80305bFb41ADD710eCA576368ec92221113

# 2. re-open a critical position (borrow 50 USDC)
node --import tsx/esm scripts/seed-position.ts --borrow-only --borrow 50

# 3. show the danger (health factor ~1.32)
npm run check -- --chain 11155111 --user 0x4856C80305bFb41ADD710eCA576368ec92221113

# 4. THE rescue — this is the whole point (takes 1-2 min, just wait for it)
npm run monitor -- --chain 11155111 --user 0x4856C80305bFb41ADD710eCA576368ec92221113 --critical 1.5 --target 2 --yes

# 5. prove it worked
npm run check -- --chain 11155111 --user 0x4856C80305bFb41ADD710eCA576368ec92221113
```

What the judge should SEE in the recording:

- Command 3 output ends with something like `healthFactor: 1.32` and
  `level: critical`.
- Command 4 ends with `[sentinel] TX CONFIRMED: https://sepolia.etherscan.io/tx/0x1c5eae2e…`.
  (If the tx hash is different, that's fine — a NEW rescue just happened.)
- Command 5 output shows `healthFactor: <100000+>` and `level: healthy`.

If you want to say anything out loud, one sentence per step is plenty:

- Step 3: "Health factor 1.32 — below the critical 1.5, so the sentinel acts."
- Step 4 (while it scrolls): "It simulates first, checks allowance and balance,
  then broadcasts with an idempotency key — and polls until the receipt is
  verified on-chain."
- Step 5: "Back to healthy."

## Step 3 — save + submit

1. Stop the recording. Trim the quiet wait at the start of command 4 if you know
   how (skip this if you don't — not required).
2. Save as `demo.mp4` (or similar).
3. Upload to YouTube and set it to **Unlisted** (or upload the file directly if
   the submission form allows it).
4. In the DoraHacks BUIDL form, the "Demo video" field takes that link/file.
   Paste it.

Done. That's the whole video.

## Bonus flourish (optional, ~30 extra seconds)

Want to also show the "agent runs another agent" surface? After command 5, run
one more screenful:

```
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"rec","version":"0"}}}\n{"jsonrpc":"2.0","method":"notifications/initialized"}\n{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"sentinel_monitor","arguments":{"chainId":"11155111","user":"0x4856C80305bFb41ADD710eCA576368ec92221113","confirm":false}}}\n' | node --import tsx/esm src/mcp.ts
```

This drives the exact same protect loop **through the MCP server** (the
interface ChatGPT/Claude use) — it reads HF, simulates, broadcasts the repay via
KeeperHub, and returns the verified run report. It rescues whatever position is
open at that moment (re-borrow first with step 2 if it's already healthy). Only
do this if you want the extra surface in the video; the 5-command CLI rescue is
the required story.

## Keep in mind

- The transaction must be REAL — that's the judge's #1 criterion
  ("A working transaction that executes through KeeperHub beats a polished demo
  that never touches a chain").
- Every command above is idempotent and safe: step 2 only borrows (it will
  revert if there isn't enough collateral), and `monitor` only repays.
- If command 4 shows `level: healthy` instead of `critical` at step 3, re-run
  step 2 before recording — or borrow a bigger number (`--borrow 55`).
