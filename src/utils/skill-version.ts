import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";

function readPackageVersion(): string {
  const thisFile = fileURLToPath(import.meta.url);
  // bundled: dist/cli.js → 2 levels up = package root
  // dev/test: src/utils/skill-version.ts → 3 levels up = package root
  for (const levels of [2, 3]) {
    const pkgPath = join(thisFile, ...Array(levels).fill(".."), "package.json");
    if (existsSync(pkgPath)) {
      const raw: unknown = JSON.parse(readFileSync(pkgPath, "utf8"));
      if (
        typeof raw === "object" &&
        raw !== null &&
        "version" in raw &&
        typeof (raw as { version: unknown }).version === "string"
      ) {
        return (raw as { version: string }).version;
      }
    }
  }
  return "0.0.0";
}

export const CURRENT_VERSION: string = readPackageVersion();

const VERSION_RE = /^instrlint-version:\s*(.+)$/m;

function extractVersion(content: string): string | null {
  const m = VERSION_RE.exec(content);
  return m ? m[1]!.trim() : null;
}

function readInstalledVersion(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    return extractVersion(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export interface SkillUpdateInfo {
  installedVersion: string;
  currentVersion: string;
  installPath: string;
  isProject: boolean;
}

export function checkSkillUpdate(
  projectRoot: string,
  globalRoot?: string,
): SkillUpdateInfo | null {
  const resolvedGlobal = globalRoot ?? homedir();
  const candidates: Array<{ path: string; isProject: boolean }> = [
    {
      path: join(projectRoot, ".claude", "commands", "instrlint.md"),
      isProject: true,
    },
    {
      path: join(resolvedGlobal, ".claude", "commands", "instrlint.md"),
      isProject: false,
    },
  ];

  for (const { path, isProject } of candidates) {
    const installed = readInstalledVersion(path);
    if (installed !== null && installed !== CURRENT_VERSION) {
      return {
        installedVersion: installed,
        currentVersion: CURRENT_VERSION,
        installPath: path,
        isProject,
      };
    }
  }
  return null;
}

export function injectVersion(content: string, version: string): string {
  // Replace existing instrlint-version line (idempotent)
  if (/^instrlint-version:/m.test(content)) {
    return content.replace(
      /^instrlint-version:.*$/m,
      `instrlint-version: ${version}`,
    );
  }
  // Insert before closing --- of frontmatter
  const updated = content.replace(
    /^(---\n[\s\S]*?)(---)$/m,
    `$1instrlint-version: ${version}\n$2`,
  );
  if (updated === content) {
    throw new Error("injectVersion: no YAML frontmatter found in skill file");
  }
  return updated;
}
