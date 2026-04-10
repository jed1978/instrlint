import { readFileSync } from "fs";
import { relative } from "path";
import chalk from "chalk";
import { t } from "../i18n/index.js";
import type { Finding } from "../types.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StructureSuggestion {
  finding: Finding;
  /** Full rule text from the source file (falls back to snippet) */
  ruleText: string;
  type: "hook" | "path-scoped";
  /** For path-scoped: the extracted directory name (e.g. 'src') */
  pathDir?: string;
}

// ─── File helpers ─────────────────────────────────────────────────────────────

function readFileLine(filePath: string, lineNumber: number): string {
  try {
    const content = readFileSync(filePath, "utf8");
    return content.split("\n")[lineNumber - 1]?.trim() ?? "";
  } catch {
    return "";
  }
}

// ─── Path extraction ──────────────────────────────────────────────────────────

const PATH_DIR_RE = /\b(src|tests?|lib|dist)\//i;

function extractPathDir(text: string): string | undefined {
  const m = PATH_DIR_RE.exec(text);
  return m?.[1]?.toLowerCase();
}

// ─── Code generators ──────────────────────────────────────────────────────────

export function buildHookSnippet(ruleText: string): string {
  const comment = ruleText.length > 80 ? `${ruleText.slice(0, 80)}…` : ruleText;
  return JSON.stringify(
    {
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command: `# TODO: implement enforcement of:\n# ${comment}`,
              },
            ],
          },
        ],
      },
    },
    null,
    2,
  );
}

export function buildPathScopedFile(
  pathDir: string,
  ruleText: string,
): { filePath: string; content: string } {
  const filePath = `.claude/rules/${pathDir}.md`;
  const content = `---\nglobs:\n  - "${pathDir}/**"\n---\n\n${ruleText}\n`;
  return { filePath, content };
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export function buildStructureSuggestions(
  findings: Finding[],
): StructureSuggestion[] {
  const suggestions: StructureSuggestion[] = [];

  for (const finding of findings) {
    if (finding.category !== "structure") continue;
    if (
      finding.messageKey !== "structure.scopeHook" &&
      finding.messageKey !== "structure.scopePathScoped"
    ) {
      continue;
    }

    const ruleText =
      finding.line != null && finding.line > 0
        ? readFileLine(finding.file, finding.line) ||
          (finding.messageParams?.snippet ?? "")
        : (finding.messageParams?.snippet ?? "");

    if (finding.messageKey === "structure.scopeHook") {
      suggestions.push({ finding, ruleText, type: "hook" });
    } else {
      const pathDir =
        extractPathDir(ruleText) ||
        extractPathDir(finding.messageParams?.snippet ?? "") ||
        "src";
      suggestions.push({ finding, ruleText, type: "path-scoped", pathDir });
    }
  }

  return suggestions;
}

// ─── Terminal renderer ────────────────────────────────────────────────────────

function terminalCodeBlock(
  code: string,
  output: { log: typeof console.log },
): void {
  const lines = code.split("\n");
  output.log(chalk.gray("  ┌" + "─".repeat(62)));
  for (const line of lines) {
    output.log(`  ${chalk.gray("│")} ${chalk.white(line)}`);
  }
  output.log(chalk.gray("  └" + "─".repeat(62)));
}

export function printStructureSuggestions(
  suggestions: StructureSuggestion[],
  projectRoot: string,
  output: { log: typeof console.log },
): void {
  if (suggestions.length === 0) return;

  output.log("");
  output.log(chalk.bold.white(`  ${t("fix.manualActions")}`));
  output.log(chalk.gray("  ─".repeat(30)));

  for (const s of suggestions) {
    const relFile = relative(projectRoot, s.finding.file);
    const lineNum = s.finding.line ?? 0;

    output.log("");
    output.log(
      `  ${chalk.blue("ℹ")}  ${chalk.white(t(s.finding.messageKey, s.finding.messageParams))}`,
    );
    output.log("");

    if (s.type === "hook") {
      output.log(`  ${chalk.cyan(t("fix.hookCreate"))}`);
      terminalCodeBlock(buildHookSnippet(s.ruleText), output);
      output.log(`  ${chalk.yellow(t("fix.hookWarning"))}`);
      if (lineNum > 0) {
        output.log(
          `  ${chalk.gray(t("fix.thenRemoveLine", { line: String(lineNum), file: relFile }))}`,
        );
      }
    } else {
      const dir = s.pathDir ?? "src";
      const { filePath, content } = buildPathScopedFile(dir, s.ruleText);
      output.log(
        `  ${chalk.cyan(t("fix.pathScopedCreate", { path: filePath }))}`,
      );
      terminalCodeBlock(content, output);
      if (lineNum > 0) {
        output.log(
          `  ${chalk.gray(t("fix.thenRemoveLine", { line: String(lineNum), file: relFile }))}`,
        );
      }
    }
  }

  output.log("");
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

export function markdownStructureSuggestions(
  suggestions: StructureSuggestion[],
  projectRoot: string,
): string[] {
  if (suggestions.length === 0) return [];

  const lines: string[] = [`## ${t("fix.manualActions")}`, ""];

  for (const s of suggestions) {
    const relFile = relative(projectRoot, s.finding.file);
    const lineNum = s.finding.line ?? 0;
    const icon =
      s.finding.severity === "critical"
        ? "🔴"
        : s.finding.severity === "warning"
          ? "🟡"
          : "ℹ️";

    lines.push(
      `### ${icon} ${t(s.finding.messageKey, s.finding.messageParams)}`,
      "",
    );

    if (s.type === "hook") {
      lines.push(
        t("fix.hookCreate"),
        "",
        "```json",
        buildHookSnippet(s.ruleText),
        "```",
        "",
      );
      lines.push(`> ${t("fix.hookWarning")}`, "");
      if (lineNum > 0) {
        lines.push(
          `_${t("fix.thenRemoveLine", { line: String(lineNum), file: relFile })}_`,
          "",
        );
      }
    } else {
      const dir = s.pathDir ?? "src";
      const { filePath, content } = buildPathScopedFile(dir, s.ruleText);
      lines.push(t("fix.pathScopedCreate", { path: filePath }), "");
      lines.push("```markdown", content, "```", "");
      if (lineNum > 0) {
        lines.push(
          `_${t("fix.thenRemoveLine", { line: String(lineNum), file: relFile })}_`,
          "",
        );
      }
    }
  }

  return lines;
}
