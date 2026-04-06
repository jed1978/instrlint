import chalk from "chalk";
import type { BudgetSummary, Finding, HealthReport } from "../types.js";
import { bar, pct } from "../commands/budget-command.js";
import { t, plural, getLocale } from "../i18n/index.js";

// ─── Visual helpers ───────────────────────────────────────────────────────────

const BOX_W = 50;
const ANSI_RE = /\x1b\[[0-9;]*m/g;

function visLen(s: string): number {
  return s.replace(ANSI_RE, "").length;
}

function padR(s: string, w: number): string {
  return s + " ".repeat(Math.max(0, w - visLen(s)));
}

function gradeColor(grade: string): (s: string) => string {
  if (grade === "A") return chalk.green;
  if (grade === "B") return chalk.cyan;
  if (grade === "C") return chalk.yellow;
  if (grade === "D") return chalk.magenta;
  return chalk.red;
}

function gradeBadge(grade: string): string {
  const bg =
    grade === "A"
      ? chalk.bgGreen
      : grade === "B"
        ? chalk.bgCyan
        : grade === "C"
          ? chalk.bgYellow
          : grade === "D"
            ? chalk.bgMagenta
            : chalk.bgRed;
  return bg(chalk.bold.white(` ${grade} `));
}

function scoreBar(score: number, grade: string, width = 30): string {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  return gradeColor(grade)("█".repeat(filled)) + chalk.gray("░".repeat(empty));
}

function sectionHeader(title: string, width = BOX_W): string {
  const inner = ` ${title} `;
  const remaining = Math.max(0, width - 2 - inner.length);
  return chalk.gray(`  ──${chalk.bold.white(inner)}${"─".repeat(remaining)}──`);
}

// ─── Compact helpers ───────────────────────────────────────────────────────────

function printCompactBudget(
  summary: BudgetSummary,
  output: { log: typeof console.log },
): void {
  const total = summary.totalBaseline;
  const window = total + summary.availableTokens;
  const fraction = total / window;
  const fmt = new Intl.NumberFormat(getLocale());
  const usedPrefix = summary.tokenMethod === "estimated" ? "~" : "";
  const budgetLine = t("compact.budgetLine", {
    used: `${usedPrefix}${fmt.format(total)}`,
    window: fmt.format(window),
    pct: String(Math.round(fraction * 100)),
  });
  output.log(`  ${chalk.yellow(budgetLine)}  ${bar(fraction, 14)}`);
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function printFindingsTable(
  findings: Finding[],
  output: { log: typeof console.log },
): void {
  const categories: Array<{ key: string; label: string }> = [
    { key: "contradiction", label: t("compact.contradictions") },
    { key: "budget", label: t("compact.budget") },
    { key: "dead-rule", label: t("compact.deadRules") },
    { key: "duplicate", label: t("compact.duplicates") },
    { key: "stale-ref", label: t("compact.staleRefs") },
    { key: "structure", label: t("compact.structure") },
  ];

  const rows = categories
    .map(({ key, label }) => {
      const group = findings.filter((f) => f.category === key);
      return {
        label,
        critical: group.filter((f) => f.severity === "critical").length,
        warning: group.filter((f) => f.severity === "warning").length,
        info: group.filter((f) => f.severity === "info").length,
      };
    })
    .filter((r) => r.critical + r.warning + r.info > 0);

  if (rows.length === 0) return;

  output.log(sectionHeader(t("label.findings")));
  for (const row of rows) {
    const parts: string[] = [];
    if (row.critical > 0) parts.push(chalk.red(`✖ ${row.critical}`));
    if (row.warning > 0) parts.push(chalk.yellow(`⚠ ${row.warning}`));
    if (row.info > 0) parts.push(chalk.blue(`ℹ ${row.info}`));
    output.log(`  ${chalk.white(row.label.padEnd(18))}${parts.join("  ")}`);
  }
}

function printTopIssues(
  findings: Finding[],
  output: { log: typeof console.log },
): void {
  if (findings.length === 0) return;

  const sorted = [...findings].sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3),
  );
  const top = sorted.slice(0, 5);

  output.log("");
  output.log(sectionHeader(t("label.topIssues")));
  for (let i = 0; i < top.length; i++) {
    const f = top[i]!;
    const icon =
      f.severity === "critical"
        ? chalk.red("✖")
        : f.severity === "warning"
          ? chalk.yellow("⚠")
          : chalk.blue("ℹ");
    const msg = t(f.messageKey, f.messageParams);
    const truncated = msg.length > 68 ? `${msg.slice(0, 68)}…` : msg;
    output.log(`  ${chalk.gray(`${i + 1}.`)} ${icon}  ${truncated}`);
  }
  if (sorted.length > 5) {
    output.log(
      chalk.gray(
        `     ${t("compact.andMore", { count: String(sorted.length - 5) })}`,
      ),
    );
  }
}

// ─── Terminal reporter ─────────────────────────────────────────────────────────

export function printCombinedTerminal(
  report: HealthReport,
  output: { log: typeof console.log } = console,
): void {
  const { project, tool, score, grade, tokenMethod } = report;
  const border = "─".repeat(BOX_W);

  // ─── Header box ─────────────────────────────────────────────────────────────
  output.log("");
  output.log(chalk.gray(`  ╭${border}╮`));
  const line1 = `  ${chalk.bold.white("instrlint")}  ${chalk.gray("─")}  ${chalk.cyan(project)}`;
  output.log(`  │${padR(line1, BOX_W)}│`);
  const line2 = `  ${chalk.gray(tool)}  ${chalk.gray("·")}  ${chalk.gray(tokenMethod)}`;
  output.log(`  │${padR(line2, BOX_W)}│`);
  output.log(chalk.gray(`  ├${border}┤`));
  const scoreLine = `  ${scoreBar(score, grade)}  ${chalk.bold.white(String(score))}/100  ${gradeBadge(grade)}`;
  output.log(`  │${padR(scoreLine, BOX_W)}│`);
  output.log(chalk.gray(`  ╰${border}╯`));

  // ─── Budget ─────────────────────────────────────────────────────────────────
  output.log("");
  output.log(sectionHeader(t("label.budget")));
  printCompactBudget(report.budget, output);

  // ─── Findings ───────────────────────────────────────────────────────────────
  if (report.findings.length > 0) {
    output.log("");
    printFindingsTable(report.findings, output);
    printTopIssues(report.findings, output);
  }

  // ─── Footer ─────────────────────────────────────────────────────────────────
  output.log("");
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
    const summary = parts.join(chalk.gray(" · "));
    const summaryVisible = summary.replace(ANSI_RE, "");
    const pad = Math.max(0, BOX_W - 2 - summaryVisible.length);
    output.log(
      chalk.gray(`  ──`) + ` ${summary} ` + chalk.gray("─".repeat(pad)),
    );
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
