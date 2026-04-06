import { execSync } from "child_process";
import { basename } from "path";
import chalk from "chalk";
import { scanProject } from "../core/scanner.js";
import { loadClaudeCodeProject } from "../adapters/claude-code.js";
import { ensureInitialized } from "../detectors/token-estimator.js";
import { analyzeBudget } from "../analyzers/budget.js";
import { analyzeDeadRules } from "../analyzers/dead-rules.js";
import { analyzeStructure } from "../analyzers/structure.js";
import { calculateScore, buildActionPlan } from "../core/scorer.js";
import {
  printCombinedTerminal,
  reportJson,
  reportMarkdown,
} from "../core/reporter.js";
import { removeDeadRules } from "../fixers/remove-dead.js";
import { removeStaleRefs } from "../fixers/remove-stale.js";
import { deduplicateRules } from "../fixers/deduplicate.js";
import { t, plural, initLocale, getLocale } from "../i18n/index.js";
import type { HealthReport } from "../types.js";

// ─── Git helpers ───────────────────────────────────────────────────────────────

function isGitClean(cwd: string): boolean {
  try {
    const out = execSync("git status --porcelain", { cwd, encoding: "utf8" });
    return out.trim().length === 0;
  } catch {
    // Not a git repo or git unavailable — proceed without blocking
    return true;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RunCommandOpts {
  format: string;
  tool?: string;
  lang?: string;
  fix?: boolean;
  force?: boolean;
  projectRoot?: string;
}

export interface RunCommandResult {
  exitCode: number;
  errorMessage?: string;
}

// ─── Core logic ───────────────────────────────────────────────────────────────

export async function runAll(
  opts: RunCommandOpts,
  output: { log: typeof console.log; error: typeof console.error } = console,
): Promise<RunCommandResult> {
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

  // --fix: require clean working tree unless --force is set
  if (opts.fix && !opts.force && !isGitClean(projectRoot)) {
    output.error(t("error.dirtyWorkingTree"));
    return { exitCode: 1, errorMessage: "dirty working tree" };
  }

  const instructions = loadClaudeCodeProject(projectRoot);

  const { findings: budgetFindings, summary } = analyzeBudget(instructions);
  const { findings: deadRuleFindings } = analyzeDeadRules(
    instructions,
    projectRoot,
  );
  const { findings: structureFindings } = analyzeStructure(
    instructions,
    projectRoot,
  );

  const allFindings = [
    ...budgetFindings,
    ...deadRuleFindings,
    ...structureFindings,
  ];
  const { score, grade } = calculateScore(allFindings, summary);
  const actionPlan = buildActionPlan(allFindings);

  const report: HealthReport = {
    project: basename(projectRoot),
    tool: instructions.tool,
    score,
    grade,
    locale: getLocale(),
    tokenMethod: summary.tokenMethod,
    findings: allFindings,
    budget: summary,
    actionPlan,
  };

  // ── Apply fixes ──────────────────────────────────────────────────────────────
  if (opts.fix) {
    const deadFixed = removeDeadRules(allFindings);
    const staleFixed = removeStaleRefs(allFindings);
    const dupeFixed = deduplicateRules(allFindings);
    const total = deadFixed + staleFixed + dupeFixed;

    if (total === 0) {
      output.log(chalk.green(`  ${t("status.noAutoFixable")}`));
    } else {
      output.log("");
      output.log(chalk.bold.white(`  ${t("label.fixSummary")}`));
      output.log(chalk.gray("  ─".repeat(30)));
      if (deadFixed > 0)
        output.log(
          `  ${chalk.yellow("⚠")}  ${t("fix.removedDeadRules", { count: String(deadFixed), s: plural(deadFixed) })}`,
        );
      if (staleFixed > 0)
        output.log(
          `  ${chalk.yellow("⚠")}  ${t("fix.removedStaleRefs", { count: String(staleFixed), s: plural(staleFixed) })}`,
        );
      if (dupeFixed > 0)
        output.log(
          `  ${chalk.yellow("⚠")}  ${t("fix.removedDuplicates", { count: String(dupeFixed), s: plural(dupeFixed) })}`,
        );
      output.log(chalk.gray("  ─".repeat(30)));
      output.log(
        chalk.green(
          `  ${t("status.fixedIssues", { count: String(total), s: plural(total) })}`,
        ),
      );
      output.log("");
    }
    return { exitCode: 0 };
  }

  // ── Format output ────────────────────────────────────────────────────────────
  if (opts.format === "json") {
    output.log(reportJson(report));
    return { exitCode: 0 };
  }

  if (opts.format === "markdown") {
    output.log(reportMarkdown(report));
    return { exitCode: 0 };
  }

  printCombinedTerminal(report, output);
  return { exitCode: 0 };
}
