import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { t } from "../i18n/index.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InstallCommandOpts {
  claudeCode?: boolean;
  codex?: boolean;
  project?: boolean;
  force?: boolean;
  projectRoot?: string;
}

export interface InstallCommandResult {
  exitCode: number;
  errorMessage?: string;
}

// ─── File resolution ──────────────────────────────────────────────────────────

function resolveSkillFile(target: "claude-code" | "codex"): string {
  const thisFile = fileURLToPath(import.meta.url);
  const subDir = target === "claude-code" ? "claude-code" : "codex";

  // tsup bundles into dist/cli.js (2 levels up = package root).
  // In dev/test, file is at src/commands/install-command.ts (3 levels up = package root).
  // Try both, use whichever has the skills directory.
  for (const levels of [2, 3]) {
    const parts = Array(levels).fill("..");
    const candidate = join(thisFile, ...parts, "skills", subDir, "SKILL.md");
    if (existsSync(candidate)) return candidate;
  }

  // Fallback: return the 2-level path so the error message shows a useful path
  return join(thisFile, "..", "..", "skills", subDir, "SKILL.md");
}

function readSkillContent(target: "claude-code" | "codex"): string {
  const skillPath = resolveSkillFile(target);
  try {
    return readFileSync(skillPath, "utf8");
  } catch {
    throw new Error(
      `Could not read skill file at ${skillPath}. Make sure the package is properly installed.`,
    );
  }
}

// ─── Install targets ──────────────────────────────────────────────────────────

function installClaudeCode(
  content: string,
  projectRoot: string,
  isProject: boolean,
  force: boolean,
  output: { log: typeof console.log; error: typeof console.error },
): InstallCommandResult {
  const targetDir = isProject
    ? join(projectRoot, ".claude", "skills", "instrlint")
    : join(homedir(), ".claude", "skills", "instrlint");

  const targetPath = join(targetDir, "SKILL.md");

  if (existsSync(targetPath) && !force) {
    output.error(t("install.alreadyExists", { path: targetPath }));
    return { exitCode: 1, errorMessage: "file already exists" };
  }

  mkdirSync(targetDir, { recursive: true });
  writeFileSync(targetPath, content, "utf8");
  output.log(t("install.installed", { path: targetPath }));
  return { exitCode: 0 };
}

function installCodex(
  content: string,
  projectRoot: string,
  force: boolean,
  output: { log: typeof console.log; error: typeof console.error },
): InstallCommandResult {
  const targetDir = join(projectRoot, ".agents", "skills", "instrlint");
  const targetPath = join(targetDir, "SKILL.md");

  if (existsSync(targetPath) && !force) {
    output.error(t("install.alreadyExists", { path: targetPath }));
    return { exitCode: 1, errorMessage: "file already exists" };
  }

  mkdirSync(targetDir, { recursive: true });
  writeFileSync(targetPath, content, "utf8");
  output.log(t("install.installed", { path: targetPath }));
  return { exitCode: 0 };
}

// ─── Core logic ───────────────────────────────────────────────────────────────

export function runInstall(
  opts: InstallCommandOpts,
  output: { log: typeof console.log; error: typeof console.error } = console,
): InstallCommandResult {
  const projectRoot = opts.projectRoot ?? process.cwd();
  const force = opts.force ?? false;

  if (opts.claudeCode) {
    let content: string;
    try {
      content = readSkillContent("claude-code");
    } catch (err) {
      output.error(String(err));
      return { exitCode: 1, errorMessage: String(err) };
    }
    return installClaudeCode(
      content,
      projectRoot,
      opts.project ?? false,
      force,
      output,
    );
  }

  if (opts.codex) {
    let content: string;
    try {
      content = readSkillContent("codex");
    } catch (err) {
      output.error(String(err));
      return { exitCode: 1, errorMessage: String(err) };
    }
    return installCodex(content, projectRoot, force, output);
  }

  output.error(t("install.unknownTarget"));
  return { exitCode: 1, errorMessage: "no target specified" };
}
