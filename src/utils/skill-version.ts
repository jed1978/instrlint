import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export const CURRENT_VERSION = "0.1.3";

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

export function checkSkillUpdate(projectRoot: string): SkillUpdateInfo | null {
  const candidates: Array<{ path: string; isProject: boolean }> = [
    {
      path: join(projectRoot, ".claude", "commands", "instrlint.md"),
      isProject: true,
    },
    {
      path: join(homedir(), ".claude", "commands", "instrlint.md"),
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
  // Insert instrlint-version into existing frontmatter block
  return content.replace(/^(---\n[\s\S]*?)(---)$/m, `$1instrlint-version: ${version}\n$2`);
}
