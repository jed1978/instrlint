import { existsSync } from "fs";
import { join } from "path";
import type { ToolType } from "../types.js";

type ScanConfidence = "high" | "low" | "ambiguous";

interface ScanResult {
  tool: ToolType;
  /** Absolute path to the root instruction file (e.g. CLAUDE.md or AGENTS.md) */
  rootFilePath: string | null;
  /** Absolute path to the config directory (e.g. .claude/, .agents/) */
  configDir: string | null;
  confidence: ScanConfidence;
}

interface Detection {
  tool: ToolType;
  rootFilePath: string | null;
  configDir: string | null;
}

function detectAll(projectRoot: string): Detection[] {
  const detections: Detection[] = [];

  // Claude Code: .claude/ directory
  const claudeDir = join(projectRoot, ".claude");
  if (existsSync(claudeDir)) {
    const rootInDir = join(claudeDir, "CLAUDE.md");
    const rootAtRoot = join(projectRoot, "CLAUDE.md");
    detections.push({
      tool: "claude-code",
      rootFilePath: existsSync(rootInDir)
        ? rootInDir
        : existsSync(rootAtRoot)
          ? rootAtRoot
          : null,
      configDir: claudeDir,
    });
  }

  // Codex: .agents/ directory
  const agentsDir = join(projectRoot, ".agents");
  if (existsSync(agentsDir)) {
    const agentsMd = join(projectRoot, "AGENTS.md");
    detections.push({
      tool: "codex",
      rootFilePath: existsSync(agentsMd) ? agentsMd : null,
      configDir: agentsDir,
    });
  }

  // Codex: .codex/ directory (alternative)
  const codexDir = join(projectRoot, ".codex");
  if (existsSync(codexDir) && !detections.some((d) => d.tool === "codex")) {
    const agentsMd = join(projectRoot, "AGENTS.md");
    detections.push({
      tool: "codex",
      rootFilePath: existsSync(agentsMd) ? agentsMd : null,
      configDir: codexDir,
    });
  }

  // Cursor: .cursor/ directory or .cursorrules file
  const cursorDir = join(projectRoot, ".cursor");
  const cursorRules = join(projectRoot, ".cursorrules");
  if (existsSync(cursorDir) || existsSync(cursorRules)) {
    detections.push({
      tool: "cursor",
      rootFilePath: existsSync(cursorRules) ? cursorRules : null,
      configDir: existsSync(cursorDir) ? cursorDir : null,
    });
  }

  return detections;
}

function detectByRootFile(projectRoot: string): Detection | null {
  const claudeMd = join(projectRoot, "CLAUDE.md");
  if (existsSync(claudeMd)) {
    return { tool: "claude-code", rootFilePath: claudeMd, configDir: null };
  }

  const agentsMd = join(projectRoot, "AGENTS.md");
  if (existsSync(agentsMd)) {
    return { tool: "codex", rootFilePath: agentsMd, configDir: null };
  }

  return null;
}

export function scanProject(
  projectRoot: string,
  forceTool?: string,
): ScanResult {
  if (!existsSync(projectRoot)) {
    throw new Error(`Project root does not exist: ${projectRoot}`);
  }

  // --tool flag overrides everything
  if (forceTool != null) {
    const valid: ToolType[] = ["claude-code", "codex", "cursor"];
    if (!valid.includes(forceTool as ToolType)) {
      throw new Error(
        `Invalid tool: "${forceTool}". Must be one of: ${valid.join(", ")}`,
      );
    }
    const tool = forceTool as ToolType;
    // Still try to find the root file for this tool
    const detections = detectAll(projectRoot);
    const match = detections.find((d) => d.tool === tool);
    return {
      tool,
      rootFilePath: match?.rootFilePath ?? null,
      configDir: match?.configDir ?? null,
      confidence: "high",
    };
  }

  const detections = detectAll(projectRoot);

  if (detections.length === 0) {
    // Fall back to checking for bare root files
    const byFile = detectByRootFile(projectRoot);
    if (byFile != null) {
      return { ...byFile, confidence: "low" };
    }
    return {
      tool: "unknown",
      rootFilePath: null,
      configDir: null,
      confidence: "low",
    };
  }

  if (detections.length === 1) {
    const d = detections[0]!;
    return {
      tool: d.tool,
      rootFilePath: d.rootFilePath,
      configDir: d.configDir,
      confidence: "high",
    };
  }

  // Multiple detections — use the first match, mark ambiguous
  const first = detections[0]!;
  return {
    tool: first.tool,
    rootFilePath: first.rootFilePath,
    configDir: first.configDir,
    confidence: "ambiguous",
  };
}
