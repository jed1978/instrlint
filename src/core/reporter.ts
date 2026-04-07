import chalk from "chalk";
import type { BudgetSummary, Finding, HealthReport } from "../types.js";
import { bar } from "../commands/budget-command.js";
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
  // Light backgrounds (A/B/C) need dark text; dark backgrounds (D/F) need white text
  if (grade === "A") return chalk.bgGreen(chalk.bold.black(` ${grade} `));
  if (grade === "B") return chalk.bgCyan(chalk.bold.black(` ${grade} `));
  if (grade === "C") return chalk.bgYellow(chalk.bold.black(` ${grade} `));
  if (grade === "D") return chalk.bgMagenta(chalk.bold.white(` ${grade} `));
  return chalk.bgRed(chalk.bold.white(` ${grade} `));
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
    output.log(
      `  ${chalk.whiteBright(row.label.padEnd(18))}${parts.join("  ")}`,
    );
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
    const verifyBadge =
      f.verification?.verdict === "confirmed"
        ? chalk.green(` ✓ ${t("verification.confirmed")}`)
        : f.verification?.verdict === "uncertain"
          ? chalk.yellow(` ❓ ${t("verification.uncertain")}`)
          : "";
    output.log(
      `  ${chalk.white(`${i + 1}.`)} ${icon}  ${truncated}${verifyBadge}`,
    );
  }
  if (sorted.length > 5) {
    output.log(
      chalk.white(
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
  const B = chalk.green; // box border colour — use consistently
  output.log(B(`  ╭${border}╮`));
  const line1 = `  ${chalk.bold.white("instrlint")}  ${B("─")}  ${chalk.cyan(project)}`;
  output.log(`  ${B("│")}${padR(line1, BOX_W)}${B("│")}`);
  const line2 = `  ${chalk.white(tool)}  ${B("·")}  ${chalk.white(tokenMethod)}`;
  output.log(`  ${B("│")}${padR(line2, BOX_W)}${B("│")}`);
  output.log(B(`  ├${border}┤`));
  const scoreLine = `  ${scoreBar(score, grade)}  ${chalk.bold.white(String(score))}/100  ${gradeBadge(grade)}`;
  output.log(`  ${B("│")}${padR(scoreLine, BOX_W)}${B("│")}`);
  output.log(B(`  ╰${border}╯`));

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
  if (report.rejectedByVerification) {
    output.log(
      chalk.gray(
        `  ${t("verification.filteredCount", { count: String(report.rejectedByVerification), s: plural(report.rejectedByVerification) })}`,
      ),
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

function mdBar(fraction: number, width = 20): string {
  const filled = Math.round(Math.min(1, Math.max(0, fraction)) * width);
  const empty = width - filled;
  return "`" + "█".repeat(filled) + "░".repeat(empty) + "`";
}

function mdFormatTokens(
  count: number,
  method: "measured" | "estimated",
): string {
  const fmt = new Intl.NumberFormat(getLocale());
  return method === "estimated" ? `~${fmt.format(count)}` : fmt.format(count);
}

export function reportMarkdown(
  report: HealthReport,
  extraSections: string[] = [],
): string {
  const { project, tool, score, grade, findings, budget } = report;
  const criticals = findings.filter((f) => f.severity === "critical").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const infos = findings.filter((f) => f.severity === "info").length;
  const gradeEmoji =
    grade === "A"
      ? "🟢"
      : grade === "B"
        ? "🔵"
        : grade === "C"
          ? "🟡"
          : grade === "D"
            ? "🟠"
            : "🔴";

  const lines: string[] = [
    `# ${t("markdown.title", { project })}`,
    "",
    `${gradeEmoji} **${score}/100 (${grade})** ${mdBar(score / 100, 25)} · \`${tool}\``,
    "",
    t("markdown.summary"),
    "",
    `| ${t("markdown.severity")} | ${t("markdown.count")} |`,
    "|----------|-------|",
    `| ${t("markdown.critical")} | ${criticals} |`,
    `| ${t("markdown.warning")} | ${warnings} |`,
    `| ${t("markdown.info")} | ${infos} |`,
    ...(report.rejectedByVerification
      ? [
          `| ${t("verification.filteredCount", { count: String(report.rejectedByVerification), s: plural(report.rejectedByVerification) })} | |`,
        ]
      : []),
    "",
  ];

  // ── Budget breakdown ─────────────────────────────────────────────────────
  const window = budget.totalBaseline + budget.availableTokens;
  const budgetRows: Array<{
    labelKey: string;
    tokens: number;
    method: "measured" | "estimated";
  }> = [
    {
      labelKey: "label.systemPrompt",
      tokens: budget.systemPromptTokens,
      method: "estimated" as const,
    },
    {
      labelKey: "label.rootFile",
      tokens: budget.rootFileTokens,
      method: budget.rootFileMethod,
    },
    {
      labelKey: "label.ruleFiles",
      tokens: budget.rulesTokens,
      method: budget.rulesMethod,
    },
    {
      labelKey: "label.skillFiles",
      tokens: budget.skillsTokens,
      method: budget.skillsMethod,
    },
    {
      labelKey: "label.subDirFiles",
      tokens: budget.subFilesTokens,
      method: budget.subFilesMethod,
    },
    {
      labelKey: "label.mcpServers",
      tokens: budget.mcpTokens,
      method: "estimated" as const,
    },
  ].filter((r) => r.tokens > 0);

  lines.push(`## ${t("label.tokenBudget")}`, "");
  lines.push(
    `| ${t("markdown.budgetCategory")} | ${t("markdown.budgetTokens")} | % | |`,
    "|------|--------|---|---|",
  );
  for (const row of budgetRows) {
    const pctVal = Math.round((row.tokens / window) * 100);
    lines.push(
      `| ${t(row.labelKey)} | ${mdFormatTokens(row.tokens, row.method)} | ${pctVal}% | ${mdBar(row.tokens / window, 12)} |`,
    );
  }
  const baselinePct = Math.round((budget.totalBaseline / window) * 100);
  lines.push(
    `| **${t("label.baselineTotal")}** | **${mdFormatTokens(budget.totalBaseline, budget.tokenMethod)}** | **${baselinePct}%** | ${mdBar(budget.totalBaseline / window, 12)} |`,
  );
  lines.push(
    `| ${t("label.available")} | ${mdFormatTokens(budget.availableTokens, "estimated")} | ${100 - baselinePct}% | |`,
  );
  lines.push("");

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
      const verifyBadge =
        f.verification?.verdict === "confirmed"
          ? ` ✓ *${t("verification.confirmed")}*: ${f.verification.reason}`
          : f.verification?.verdict === "uncertain"
            ? ` ❓ *${t("verification.uncertain")}*: ${f.verification.reason}`
            : "";
      lines.push(
        `- ${mdSeverityIcon(f)} ${t(f.messageKey, f.messageParams)}${loc}${verifyBadge}`,
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

  // Extra sections (e.g. actionable structure suggestions)
  if (extraSections.length > 0) {
    lines.push(...extraSections);
  }

  lines.push("---", t("markdown.attribution"));
  return lines.join("\n");
}
