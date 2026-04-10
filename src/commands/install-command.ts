import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { t } from "../i18n/index.js";
import { injectVersion, CURRENT_VERSION } from "../utils/skill-version.js";

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

function resolveSkillFile(): string {
  const thisFile = fileURLToPath(import.meta.url);
  const levelCandidates = [2, 3];

  // tsup bundles into dist/cli.js (2 levels up = package root).
  // In dev/test, file is at src/commands/install-command.ts (3 levels up = package root).
  // Try both, use whichever has the skills directory.
  for (const levels of levelCandidates) {
    const parts = Array(levels).fill("..");
    const candidate = join(
      thisFile,
      ...parts,
      "skills",
      "instrlint",
      "SKILL.md",
    );
    if (existsSync(candidate)) return candidate;
  }

  // Fallback: return the first candidate's path so the error message shows a useful path
  return join(
    thisFile,
    ...Array(levelCandidates[0]).fill(".."),
    "skills",
    "instrlint",
    "SKILL.md",
  );
}

function readSkillContent(): string {
  const skillPath = resolveSkillFile();
  try {
    const raw = readFileSync(skillPath, "utf8");
    return injectVersion(raw, CURRENT_VERSION);
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
    ? join(projectRoot, ".claude", "commands")
    : join(homedir(), ".claude", "commands");

  const targetPath = join(targetDir, "instrlint.md");

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

  let content: string;
  try {
    content = readSkillContent();
  } catch (err) {
    output.error(String(err));
    return { exitCode: 1, errorMessage: String(err) };
  }

  if (opts.claudeCode) {
    return installClaudeCode(
      content,
      projectRoot,
      opts.project ?? false,
      force,
      output,
    );
  }

  if (opts.codex) {
    return installCodex(content, projectRoot, force, output);
  }

  output.error(t("install.unknownTarget"));
  return { exitCode: 1, errorMessage: "no target specified" };
}
