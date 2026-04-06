#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { scanProject } from "./core/scanner.js";
import { loadClaudeCodeProject } from "./adapters/claude-code.js";
import { ensureInitialized } from "./detectors/token-estimator.js";
import { analyzeBudget } from "./analyzers/budget.js";
import type { BudgetSummary, Finding, TokenMethod } from "./types.js";

// ─── Formatting helpers ────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat("en");

function formatTokens(count: number, method: TokenMethod): string {
  if (method === "measured") return `${fmt.format(count)} tokens`;
  return `~${fmt.format(count)} tokens (estimated)`;
}

function bar(fraction: number, width = 24): string {
  const filled = Math.round(Math.min(1, Math.max(0, fraction)) * width);
  const empty = width - filled;
  return chalk.cyan("█".repeat(filled)) + chalk.gray("░".repeat(empty));
}

function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

// ─── Budget terminal output ────────────────────────────────────────────────

function printBudgetTerminal(
  summary: BudgetSummary,
  findings: Finding[],
): void {
  const total = summary.totalBaseline;
  const window = total + summary.availableTokens;

  console.log("");
  console.log(chalk.bold.white("  TOKEN BUDGET"));
  console.log(chalk.gray("  ─".repeat(30)));

  const rows: Array<{ label: string; tokens: number; method: TokenMethod }> = [
    {
      label: "System prompt",
      tokens: summary.systemPromptTokens,
      method: "estimated",
    },
    {
      label: "Root file",
      tokens: summary.rootFileTokens,
      method: summary.rootFileMethod,
    },
    {
      label: "Rule files",
      tokens: summary.rulesTokens,
      method: summary.rulesMethod,
    },
    {
      label: "Skill files",
      tokens: summary.skillsTokens,
      method: summary.skillsMethod,
    },
    {
      label: "Sub-dir files",
      tokens: summary.subFilesTokens,
      method: summary.subFilesMethod,
    },
    { label: "MCP servers", tokens: summary.mcpTokens, method: "estimated" },
  ];

  for (const row of rows) {
    if (row.tokens === 0) continue;
    const fraction = row.tokens / window;
    const label = row.label.padEnd(14);
    const tokenStr = formatTokens(row.tokens, row.method).padStart(28);
    console.log(
      `  ${chalk.white(label)} ${bar(fraction)}  ${chalk.yellow(tokenStr)}`,
    );
  }

  console.log(chalk.gray("  ─".repeat(30)));

  const baselineFraction = total / window;
  const baselineStr = formatTokens(total, summary.tokenMethod).padStart(28);
  console.log(
    `  ${"Baseline total".padEnd(14)} ${bar(baselineFraction)}  ${chalk.bold.yellow(baselineStr)}  ${chalk.gray(pct(baselineFraction))}`,
  );

  const availStr = formatTokens(summary.availableTokens, "estimated").padStart(
    28,
  );
  console.log(
    `  ${"Available".padEnd(14)} ${"".padEnd(26)}  ${chalk.green(availStr)}`,
  );
  console.log("");

  if (findings.length === 0) {
    console.log(chalk.green("  ✓ No budget issues found"));
  } else {
    for (const f of findings) {
      const icon =
        f.severity === "critical"
          ? chalk.red("  ✖")
          : f.severity === "warning"
            ? chalk.yellow("  ⚠")
            : chalk.blue("  ℹ");
      console.log(`${icon}  ${f.suggestion}`);
    }
  }
  console.log("");
}

// ─── Shared run logic ──────────────────────────────────────────────────────

async function runBudget(opts: {
  format: string;
  tool?: string;
}): Promise<void> {
  await ensureInitialized();

  const projectRoot = process.cwd();
  const scan = scanProject(projectRoot, opts.tool);

  if (scan.tool === "unknown") {
    console.error(
      "No agent instruction files found. Run this command in a project that uses Claude Code, Codex, or Cursor.",
    );
    process.exit(1);
  }

  if (scan.rootFilePath === null) {
    console.error(
      `Found ${scan.tool} configuration but no root instruction file.`,
    );
    process.exit(1);
  }

  // Load project — currently only Claude Code adapter is implemented
  const instructions = loadClaudeCodeProject(projectRoot);
  const { findings, summary } = analyzeBudget(instructions);

  if (opts.format === "json") {
    console.log(JSON.stringify({ findings, summary }, null, 2));
    return;
  }

  printBudgetTerminal(summary, findings);
}

// ─── CLI definition ────────────────────────────────────────────────────────

const program = new Command();

program
  .enablePositionalOptions()
  .name("instrlint")
  .description(
    "Lint and optimize your CLAUDE.md / AGENTS.md — find dead rules, token waste, and structural issues",
  )
  .version("0.1.0")
  .option(
    "--format <type>",
    "output format (terminal|json|markdown)",
    "terminal",
  )
  .option("--lang <locale>", "output language (en|zh-TW)", "en")
  .option("--tool <name>", "force tool detection (claude-code|codex|cursor)")
  .option("--fix", "auto-fix safe issues (dead rules, stale refs, dupes)")
  .option("--force", "skip git clean check when using --fix")
  .action(() => {
    console.log("Not implemented yet — coming in next session");
  });

program
  .command("budget")
  .description("Token budget analysis only")
  .option(
    "--format <type>",
    "output format (terminal|json|markdown)",
    "terminal",
  )
  .option("--tool <name>", "force tool detection (claude-code|codex|cursor)")
  .action(async function (this: Command) {
    const opts = this.opts<{ format: string; tool?: string }>();
    await runBudget(opts);
  });

program
  .command("deadrules")
  .description("Dead rule detection only")
  .action(() => {
    console.log("Not implemented yet — coming in next session");
  });

program
  .command("structure")
  .description("Structural analysis only")
  .action(() => {
    console.log("Not implemented yet — coming in next session");
  });

program
  .command("install")
  .description("Install instrlint as a skill")
  .option("--claude-code", "Install as Claude Code skill")
  .option("--codex", "Install as Codex skill")
  .action(() => {
    console.log("Not implemented yet — coming in next session");
  });

program.parse();
