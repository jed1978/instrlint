import chalk from "chalk";
import { analyzeDeadRules } from "../analyzers/dead-rules.js";
import { loadProject } from "../adapters/dispatch.js";
import { ensureInitialized } from "../detectors/token-estimator.js";
import { scanProject } from "../core/scanner.js";
import { t, plural, initLocale, getLocale } from "../i18n/index.js";
import type { Finding } from "../types.js";

// ─── Terminal output ──────────────────────────────────────────────────────────

export function printDeadRulesTerminal(
  findings: Finding[],
  output: { log: typeof console.log } = console,
): void {
  const overlaps = findings.filter((f) => f.category === "dead-rule");
  const duplicates = findings.filter((f) => f.category === "duplicate");

  output.log("");
  output.log(chalk.bold.white(`  ${t("label.deadRules")}`));
  output.log(chalk.gray("  ─".repeat(30)));

  if (overlaps.length > 0) {
    output.log(chalk.bold(`  ${t("label.redundantByConfig")}`));
    for (const f of overlaps) {
      output.log(`  ${chalk.yellow("⚠")}  ${t(f.messageKey, f.messageParams)}`);
    }
    output.log("");
  }

  if (duplicates.length > 0) {
    output.log(chalk.bold(`  ${t("label.duplicates")}`));
    for (const f of duplicates) {
      const icon =
        f.severity === "warning" ? chalk.yellow("⚠") : chalk.blue("ℹ");
      output.log(`  ${icon}  ${t(f.messageKey, f.messageParams)}`);
    }
    output.log("");
  }

  output.log(chalk.gray("  ─".repeat(30)));

  if (findings.length === 0) {
    output.log(chalk.green(`  ${t("status.noDeadRules")}`));
  } else {
    const sep = getLocale() === "zh-TW" ? "、" : ", ";
    const parts: string[] = [];
    if (overlaps.length > 0)
      parts.push(
        t("summary.redundantRules", {
          count: String(overlaps.length),
          s: plural(overlaps.length),
        }),
      );
    if (duplicates.length > 0)
      parts.push(
        t("summary.duplicates", {
          count: String(duplicates.length),
          s: plural(duplicates.length),
        }),
      );
    output.log(
      chalk.yellow(`  ${t("summary.found", { parts: parts.join(sep) })}`),
    );
  }
  output.log("");
}

// ─── Core run logic ───────────────────────────────────────────────────────────

interface DeadRulesCommandOpts {
  format: string;
  tool?: string;
  lang?: string;
  projectRoot?: string;
}

interface DeadRulesCommandResult {
  exitCode: number;
  errorMessage?: string;
}

export async function runDeadRules(
  opts: DeadRulesCommandOpts,
  output: { log: typeof console.log; error: typeof console.error } = console,
): Promise<DeadRulesCommandResult> {
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
  const { findings } = analyzeDeadRules(instructions, projectRoot);

  if (opts.format === "json") {
    output.log(JSON.stringify({ findings }, null, 2));
    return { exitCode: 0 };
  }

  printDeadRulesTerminal(findings, output);
  return { exitCode: 0 };
}
