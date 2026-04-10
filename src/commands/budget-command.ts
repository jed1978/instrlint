import chalk from "chalk";
import { scanProject } from "../core/scanner.js";
import { loadProject } from "../adapters/dispatch.js";
import { ensureInitialized } from "../detectors/token-estimator.js";
import { analyzeBudget } from "../analyzers/budget.js";
import { t, initLocale, getLocale } from "../i18n/index.js";
import type { BudgetSummary, Finding, TokenMethod } from "../types.js";

// ─── Formatting helpers ────────────────────────────────────────────────────

function getFmt(): Intl.NumberFormat {
  return new Intl.NumberFormat(getLocale());
}

export function formatTokens(count: number, method: TokenMethod): string {
  const formatted = getFmt().format(count);
  if (method === "measured") return t("tokens.measured", { count: formatted });
  return t("tokens.estimated", { count: formatted });
}

export function bar(fraction: number, width = 24): string {
  const filled = Math.round(Math.min(1, Math.max(0, fraction)) * width);
  const empty = width - filled;
  return chalk.cyan("█".repeat(filled)) + chalk.gray("░".repeat(empty));
}

export function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

// ─── Budget terminal output ────────────────────────────────────────────────

export function printBudgetTerminal(
  summary: BudgetSummary,
  findings: Finding[],
  output: { log: typeof console.log } = console,
): void {
  const total = summary.totalBaseline;
  const window = total + summary.availableTokens;

  output.log("");
  output.log(chalk.bold.white(`  ${t("label.tokenBudget")}`));
  output.log(chalk.gray("  ─".repeat(30)));

  const rows: Array<{ labelKey: string; tokens: number; method: TokenMethod }> =
    [
      {
        labelKey: "label.systemPrompt",
        tokens: summary.systemPromptTokens,
        method: "estimated",
      },
      {
        labelKey: "label.rootFile",
        tokens: summary.rootFileTokens,
        method: summary.rootFileMethod,
      },
      {
        labelKey: "label.ruleFiles",
        tokens: summary.rulesTokens,
        method: summary.rulesMethod,
      },
      {
        labelKey: "label.skillFiles",
        tokens: summary.skillsTokens,
        method: summary.skillsMethod,
      },
      {
        labelKey: "label.subDirFiles",
        tokens: summary.subFilesTokens,
        method: summary.subFilesMethod,
      },
      {
        labelKey: "label.mcpServers",
        tokens: summary.mcpTokens,
        method: "estimated",
      },
    ];

  for (const row of rows) {
    if (row.tokens === 0) continue;
    const fraction = row.tokens / window;
    const label = t(row.labelKey).padEnd(14);
    const tokenStr = formatTokens(row.tokens, row.method).padStart(28);
    output.log(
      `  ${chalk.white(label)} ${bar(fraction)}  ${chalk.yellow(tokenStr)}`,
    );
  }

  output.log(chalk.gray("  ─".repeat(30)));

  const baselineFraction = total / window;
  const baselineStr = formatTokens(total, summary.tokenMethod).padStart(28);
  output.log(
    `  ${t("label.baselineTotal").padEnd(14)} ${bar(baselineFraction)}  ${chalk.bold.yellow(baselineStr)}  ${chalk.gray(pct(baselineFraction))}`,
  );

  const availStr = formatTokens(summary.availableTokens, "estimated").padStart(
    28,
  );
  output.log(
    `  ${t("label.available").padEnd(14)} ${"".padEnd(26)}  ${chalk.green(availStr)}`,
  );
  output.log("");

  if (findings.length === 0) {
    output.log(chalk.green(`  ${t("status.noBudgetIssues")}`));
  } else {
    for (const f of findings) {
      const icon =
        f.severity === "critical"
          ? chalk.red("  ✖")
          : f.severity === "warning"
            ? chalk.yellow("  ⚠")
            : chalk.blue("  ℹ");
      output.log(`${icon}  ${t(f.messageKey, f.messageParams)}`);
    }
  }
  output.log("");
}

// ─── Core run logic (testable) ─────────────────────────────────────────────

interface BudgetCommandOpts {
  format: string;
  tool?: string;
  lang?: string;
  projectRoot?: string;
}

interface BudgetCommandResult {
  exitCode: number;
  errorMessage?: string;
}

export async function runBudget(
  opts: BudgetCommandOpts,
  output: { log: typeof console.log; error: typeof console.error } = console,
): Promise<BudgetCommandResult> {
  initLocale(opts.lang);
  await ensureInitialized();

  const projectRoot = opts.projectRoot ?? process.cwd();
  const scan = scanProject(projectRoot, opts.tool);

  if (scan.tool === "unknown") {
    output.error(t("error.unknownTool"));
    return { exitCode: 1, errorMessage: "unknown tool" };
  }

  if (scan.rootFilePath === null) {
    output.error(t("error.missingRootFile", { tool: scan.tool }));
    return { exitCode: 1, errorMessage: "missing root file" };
  }

  const instructions = loadProject(projectRoot, scan.tool);
  const { findings, summary } = analyzeBudget(instructions);

  if (opts.format === "json") {
    output.log(JSON.stringify({ findings, summary }, null, 2));
    return { exitCode: 0 };
  }

  printBudgetTerminal(summary, findings, output);
  return { exitCode: 0 };
}
