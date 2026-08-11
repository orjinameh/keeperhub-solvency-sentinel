import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SentinelRunReport, VerifiedReceipt } from "./sentinel.ts";

const here = dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = resolve(here, "../docs/runs");

function slug(taskId: string): string {
  return taskId.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80);
}

export function writeRunReport(report: SentinelRunReport): { jsonPath: string; mdPath: string } {
  mkdirSync(RUNS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = `${slug(report.taskId)}-${stamp}`;
  const jsonPath = resolve(RUNS_DIR, `${base}.json`);
  const mdPath = resolve(RUNS_DIR, `${base}.md`);

  writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");
  writeFileSync(mdPath, toMarkdown(report));
  return { jsonPath, mdPath };
}

export function toMarkdown(r: SentinelRunReport): string {
  const lines: string[] = [];
  lines.push(`# Solvency Sentinel Run`);
  lines.push(``);
  if (r.dryRun) {
    lines.push(`> **DRY RUN** — simulated execution. No transaction was broadcast.`);
    lines.push(``);
  }
  lines.push(`- **Task**: \`${r.taskId}\``);
  lines.push(`- **Chain**: ${r.chainId}`);
  lines.push(`- **User (protected)**: \`${r.user}\``);
  lines.push(`- **Started**: ${r.startedAt}`);
  lines.push(`- **Finished**: ${r.finishedAt}`);
  lines.push(``);
  lines.push(`## Position snapshot`);
  lines.push(``);
  lines.push(`| metric | value |`);
  lines.push(`| --- | --- |`);
  for (const [k, v] of Object.entries(r.account)) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push(``);
  lines.push(`## Decision`);
  lines.push(``);
  lines.push(`- **Level**: ${r.decision.level}`);
  lines.push(`- **Should act**: ${r.decision.shouldAct}`);
  lines.push(`- **Reason**: ${r.decision.reason}`);
  lines.push(``);
  lines.push(`## Steps`);
  lines.push(``);
  lines.push(`| step | ok | detail |`);
  lines.push(`| --- | --- | --- |`);
  for (const s of r.steps) {
    lines.push(`| ${s.name} | ${s.ok} | ${s.detail} |`);
  }
  lines.push(``);
  if (r.execution) {
    lines.push(`## On-chain execution`);
    lines.push(``);
    lines.push(`- **Execution id**: \`${r.execution.executionId}\``);
    lines.push(`- **Status**: ${r.execution.status}`);
    lines.push(`- **Replay**: ${r.execution.idempotentReplay ?? false}`);
    lines.push(`- **Sponsored**: ${r.execution.sponsored ?? false}`);
    lines.push(`- **Transaction**: ${r.execution.transactionHash ?? "-"}`);
    if (r.execution.transactionLink) lines.push(`- **Explorer**: ${r.execution.transactionLink}`);
    if (r.execution.receipts) {
      lines.push(``);
      lines.push(`### Receipts (verified on-chain)`);
      lines.push(``);
      lines.push(`| hash | chain | verified | status | block | gas |`);
      lines.push(`| --- | --- | --- | --- | --- | --- |`);
      for (const rc of (r.execution.receipts ?? []) as VerifiedReceipt[]) {
        lines.push(
          `| ${String(rc.hash).slice(0, 18)}… | ${rc.chainId} | ${rc.verified} | ${rc.receiptStatus} | ${rc.blockNumber} | ${rc.gasUsed} |`
        );
      }
    }
    lines.push(``);
  }
  return lines.join("\n");
}
