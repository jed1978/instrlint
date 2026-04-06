import chalk from "chalk";
import { analyzeStructure } from "../analyzers/structure.js";
import { loadProject } from "../adapters/dispatch.js";
import { ensureInitialized } from "../detectors/token-estimator.js";
import { scanProject } from "../core/scanner.js";
import { t, plural, initLocale, getLocale } from "../i18n/index.js";
import type { Finding } from "../types.js";

// ─── Terminal output ──────────────────────────────────────────────────────────

export function printStructureTerminal(
  findings: Finding[],
  output: { log: typeof console.log } = console,
): void {
  const contradictions = findings.filter((f) => f.category === "contradiction");
  const staleRefs = findings.filter((f) => f.category === "stale-ref");
  const scoped = findings.filter((f) => f.category === "structure");

  output.log("");
  output.log(chalk.bold.white(`  ${t("label.structure")}`));
  output.log(chalk.gray("  ─".repeat(30)));

  if (contradictions.length > 0) {
    output.log(chalk.bold(`  ${t("label.contradictions")}`));
    for (const f of contradictions) {
      output.log(`  ${chalk.red("✖")}  ${t(f.messageKey, f.messageParams)}`);
    }
    output.log("");
  }

  if (staleRefs.length > 0) {
    output.log(chalk.bold(`  ${t("label.staleReferences")}`));
    for (const f of staleRefs) {
      output.log(`  ${chalk.yellow("⚠")}  ${t(f.messageKey, f.messageParams)}`);
    }
    output.log("");
  }

  if (scoped.length > 0) {
    output.log(chalk.bold(`  ${t("label.refactoringOpportunities")}`));
    for (const f of scoped) {
      output.log(`  ${chalk.blue("ℹ")}  ${t(f.messageKey, f.messageParams)}`);
    }
    output.log("");
  }

  output.log(chalk.gray("  ─".repeat(30)));

  if (findings.length === 0) {
    output.log(chalk.green(`  ${t("status.noStructuralIssues")}`));
  } else {
    const sep = getLocale() === "zh-TW" ? "、" : ", ";
    const parts: string[] = [];
    if (contradictions.length > 0)
      parts.push(
        t("summary.contradictions", {
          count: String(contradictions.length),
          s: plural(contradictions.length),
        }),
      );
    if (staleRefs.length > 0)
      parts.push(
        t("summary.staleRefs", {
          count: String(staleRefs.length),
          s: plural(staleRefs.length),
        }),
      );
    if (scoped.length > 0)
      parts.push(
        t("summary.refactoringSuggestions", {
          count: String(scoped.length),
          s: plural(scoped.length),
        }),
      );
    output.log(
      chalk.yellow(`  ${t("summary.found", { parts: parts.join(sep) })}`),
    );
  }
  output.log("");
}

// ─── Core run logic ───────────────────────────────────────────────────────────

export interface StructureCommandOpts {
  format: string;
  tool?: string;
  lang?: string;
  projectRoot?: string;
}

export interface StructureCommandResult {
  exitCode: number;
  errorMessage?: string;
}

export async function runStructure(
  opts: StructureCommandOpts,
  output: { log: typeof console.log; error: typeof console.error } = console,
): Promise<StructureCommandResult> {
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
  const { findings } = analyzeStructure(instructions, projectRoot);

  if (opts.format === "json") {
    output.log(JSON.stringify({ findings }, null, 2));
    return { exitCode: 0 };
  }

  printStructureTerminal(findings, output);
  return { exitCode: 0 };
}
