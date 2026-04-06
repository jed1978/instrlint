import chalk from "chalk";
import type { Finding, HealthReport } from "../types.js";
import { printBudgetTerminal } from "../commands/budget-command.js";
import { printDeadRulesTerminal } from "../commands/deadrules-command.js";
import { printStructureTerminal } from "../commands/structure-command.js";
import { t, plural } from "../i18n/index.js";

// ─── Grade colour ──────────────────────────────────────────────────────────────

function gradeColour(grade: string): string {
  if (grade === "A") return chalk.bold.green(grade);
  if (grade === "B") return chalk.bold.cyan(grade);
  if (grade === "C") return chalk.bold.yellow(grade);
  if (grade === "D") return chalk.bold.magenta(grade);
  return chalk.bold.red(grade);
}

// ─── Terminal reporter ─────────────────────────────────────────────────────────

export function printCombinedTerminal(
  report: HealthReport,
  output: { log: typeof console.log } = console,
): void {
  const { project, tool, score, grade, tokenMethod } = report;

  output.log("");
  output.log(
    chalk.bold.white(`  ══════════════════════════════════════════════════`),
  );
  output.log(
    `  ${chalk.bold.white("instrlint")}  ${chalk.gray("—")}  ${chalk.cyan(project)}`,
  );
  output.log(
    `  ${chalk.gray(t("label.tool"))} ${chalk.white(tool)}  ${chalk.gray("·")}  ${chalk.gray(tokenMethod)}`,
  );
  output.log(
    `  ${chalk.gray(t("label.score"))} ${chalk.bold.white(String(score))}/100  ${gradeColour(grade)}`,
  );
  output.log(
    chalk.bold.white(`  ══════════════════════════════════════════════════`),
  );

  // ─── Budget section ──────────────────────────────────────────────────────────
  const budgetFindings = report.findings.filter((f) => f.category === "budget");
  printBudgetTerminal(report.budget, budgetFindings, output);

  // ─── Dead rules section ──────────────────────────────────────────────────────
  const deadRuleFindings = report.findings.filter(
    (f) => f.category === "dead-rule" || f.category === "duplicate",
  );
  if (deadRuleFindings.length > 0) {
    printDeadRulesTerminal(deadRuleFindings, output);
  }

  // ─── Structure section ────────────────────────────────────────────────────────
  const structureFindings = report.findings.filter(
    (f) =>
      f.category === "contradiction" ||
      f.category === "stale-ref" ||
      f.category === "structure",
  );
  if (structureFindings.length > 0) {
    printStructureTerminal(structureFindings, output);
  }

  // ─── Action plan ──────────────────────────────────────────────────────────────
  if (report.actionPlan.length > 0) {
    output.log("");
    output.log(chalk.bold.white(`  ${t("label.actionPlan")}`));
    output.log(chalk.gray("  ─".repeat(30)));

    const top = report.actionPlan.slice(0, 10);
    for (let i = 0; i < top.length; i++) {
      const item = top[i]!;
      const icon =
        item.priority === 1
          ? chalk.red("✖")
          : item.priority === 2
            ? chalk.yellow("⚠")
            : chalk.blue("ℹ");
      const desc =
        item.description.length > 80
          ? `${item.description.slice(0, 80)}...`
          : item.description;
      output.log(`  ${i + 1}. ${icon}  ${desc}`);
    }

    if (report.actionPlan.length > 10) {
      output.log(
        chalk.gray(
          `  ${t("actionPlan.andMore", { count: String(report.actionPlan.length - 10) })}`,
        ),
      );
    }
    output.log("");
  }

  output.log(
    chalk.bold.white(`  ══════════════════════════════════════════════════`),
  );
  if (report.findings.length === 0) {
    output.log(chalk.green(`  ${t("status.perfectScore")}`));
  } else {
    const criticals = report.findings.filter(
      (f) => f.severity === "critical",
    ).length;
    const warnings = report.findings.filter(
      (f) => f.severity === "warning",
    ).length;
    const infos = report.findings.filter((f) => f.severity === "info").length;
    const parts: string[] = [];
    if (criticals > 0)
      parts.push(
        chalk.red(t("severity.critical", { count: String(criticals) })),
      );
    if (warnings > 0)
      parts.push(
        chalk.yellow(
          t("severity.warnings", {
            count: String(warnings),
            s: plural(warnings),
          }),
        ),
      );
    if (infos > 0)
      parts.push(
        chalk.blue(
          t("severity.suggestions", { count: String(infos), s: plural(infos) }),
        ),
      );
    output.log(`  ${parts.join(chalk.gray(" · "))}`);
  }
  output.log("");
}

// ─── JSON reporter ─────────────────────────────────────────────────────────────

export function reportJson(report: HealthReport): string {
  return JSON.stringify(report, null, 2);
}

// ─── Markdown reporter ─────────────────────────────────────────────────────────

function mdSeverityIcon(f: Finding): string {
  if (f.severity === "critical") return "🔴";
  if (f.severity === "warning") return "🟡";
  return "ℹ️";
}

export function reportMarkdown(report: HealthReport): string {
  const { project, tool, score, grade, findings } = report;
  const criticals = findings.filter((f) => f.severity === "critical").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const infos = findings.filter((f) => f.severity === "info").length;

  const lines: string[] = [
    `# ${t("markdown.title", { project })}`,
    "",
    t("markdown.scoreLine", { score: String(score), grade, tool }),
    "",
    t("markdown.summary"),
    "",
    `| ${t("markdown.severity")} | ${t("markdown.count")} |`,
    "|----------|-------|",
    `| ${t("markdown.critical")} | ${criticals} |`,
    `| ${t("markdown.warning")} | ${warnings} |`,
    `| ${t("markdown.info")} | ${infos} |`,
    "",
  ];

  // Findings grouped by category
  const categories: Array<{
    labelKey: string;
    filter: (f: Finding) => boolean;
  }> = [
    {
      labelKey: "markdown.contradictions",
      filter: (f) => f.category === "contradiction",
    },
    {
      labelKey: "markdown.staleReferences",
      filter: (f) => f.category === "stale-ref",
    },
    {
      labelKey: "markdown.deadRules",
      filter: (f) => f.category === "dead-rule",
    },
    {
      labelKey: "markdown.duplicateRules",
      filter: (f) => f.category === "duplicate",
    },
    {
      labelKey: "markdown.budgetIssues",
      filter: (f) => f.category === "budget",
    },
    {
      labelKey: "markdown.refactoringOpportunities",
      filter: (f) => f.category === "structure",
    },
  ];

  for (const { labelKey, filter } of categories) {
    const group = findings.filter(filter);
    if (group.length === 0) continue;
    lines.push(`## ${t(labelKey)}`, "");
    for (const f of group) {
      const loc =
        f.line != null
          ? ` ${t("markdown.lineRef", { line: String(f.line) })}`
          : "";
      lines.push(
        `- ${mdSeverityIcon(f)} ${t(f.messageKey, f.messageParams)}${loc}`,
      );
    }
    lines.push("");
  }

  // Action plan
  if (report.actionPlan.length > 0) {
    lines.push(t("markdown.actionPlan"), "");
    for (let i = 0; i < Math.min(report.actionPlan.length, 10); i++) {
      const item = report.actionPlan[i]!;
      lines.push(`${i + 1}. ${item.description}`);
    }
    lines.push("");
  }

  lines.push("---", t("markdown.attribution"));
  return lines.join("\n");
}
