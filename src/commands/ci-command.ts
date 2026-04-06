import { writeFileSync } from "fs";
import { basename } from "path";
import { scanProject } from "../core/scanner.js";
import { loadProject } from "../adapters/dispatch.js";
import { ensureInitialized } from "../detectors/token-estimator.js";
import { analyzeBudget } from "../analyzers/budget.js";
import { analyzeDeadRules } from "../analyzers/dead-rules.js";
import { analyzeStructure } from "../analyzers/structure.js";
import { calculateScore, buildActionPlan } from "../core/scorer.js";
import { reportJson, reportMarkdown } from "../core/reporter.js";
import { reportSarif } from "../reporters/sarif.js";
import { t, initLocale, getLocale } from "../i18n/index.js";
import type { Finding, HealthReport } from "../types.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FailOn = "critical" | "warning" | "info";

export interface CiCommandOpts {
  format?: string;
  tool?: string;
  lang?: string;
  failOn?: FailOn;
  output?: string;
  projectRoot?: string;
}

export interface CiCommandResult {
  exitCode: number;
  errorMessage?: string;
}

// ─── Threshold helpers ────────────────────────────────────────────────────────

function shouldFail(findings: Finding[], failOn: FailOn): boolean {
  if (failOn === "info") return findings.length > 0;
  if (failOn === "warning")
    return findings.some(
      (f) => f.severity === "critical" || f.severity === "warning",
    );
  // default: critical
  return findings.some((f) => f.severity === "critical");
}

// ─── Core logic ───────────────────────────────────────────────────────────────

export async function runCi(
  opts: CiCommandOpts,
  output: { log: typeof console.log; error: typeof console.error } = console,
): Promise<CiCommandResult> {
  initLocale(opts.lang);
  await ensureInitialized();

  const projectRoot = opts.projectRoot ?? process.cwd();
  const failOn: FailOn = opts.failOn ?? "critical";
  const format = opts.format ?? "terminal";

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

  // ── Format output ─────────────────────────────────────────────────────────
  let formatted: string;
  if (format === "sarif") {
    formatted = reportSarif(report);
  } else if (format === "json") {
    formatted = reportJson(report);
  } else if (format === "markdown") {
    formatted = reportMarkdown(report);
  } else {
    formatted = reportJson(report);
  }

  if (opts.output != null) {
    writeFileSync(opts.output, formatted, "utf8");
    const pass = !shouldFail(allFindings, failOn);
    const statusKey = pass ? "ci.passed" : "ci.failed";
    output.error(
      `${t(statusKey, { score: String(score), grade })}  ${t("ci.writtenTo", { file: opts.output })}`,
    );
  } else {
    output.log(formatted);
  }

  const failed = shouldFail(allFindings, failOn);
  return { exitCode: failed ? 1 : 0 };
}
