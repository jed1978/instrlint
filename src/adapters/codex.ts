import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { parseInstructionFile } from "../core/parser.js";
import {
  countTokens,
  estimateMcpTokens,
} from "../detectors/token-estimator.js";
import type {
  InstructionFile,
  McpServerConfig,
  ParsedInstructions,
  SkillFile,
} from "../types.js";

// ─── Helpers ───────────────────────────────────────────────────────────────

function safeParseFile(filePath: string): InstructionFile | null {
  try {
    const raw = readFileSync(filePath, "utf8");
    const file = parseInstructionFile(filePath);
    const { count, method } = countTokens(raw);
    return { ...file, tokenCount: count, tokenMethod: method };
  } catch {
    process.stderr.write(
      `[instrlint] Warning: could not read ${filePath}, skipping\n`,
    );
    return null;
  }
}

function emptyFile(path: string): InstructionFile {
  return {
    path,
    lines: [],
    lineCount: 0,
    tokenCount: 0,
    tokenMethod: "estimated",
  };
}

// ─── Skills ───────────────────────────────────────────────────────────────

function loadSkills(projectRoot: string): SkillFile[] {
  const skillsDir = join(projectRoot, ".agents", "skills");
  if (!existsSync(skillsDir)) return [];

  const skills: SkillFile[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(skillsDir);
  } catch {
    return [];
  }

  for (const skillName of entries) {
    const skillFile = join(skillsDir, skillName, "SKILL.md");
    if (!existsSync(skillFile)) continue;
    const parsed = safeParseFile(skillFile);
    if (parsed != null) {
      skills.push({ ...parsed, skillName });
    }
  }

  return skills;
}

// ─── MCP servers from .codex/config.toml ─────────────────────────────────

/**
 * Minimal TOML parser targeting only [mcp_servers.<name>] sections.
 * Handles simple key = "value" and key = ["array"] under those sections.
 */
function parseMcpFromToml(toml: string): McpServerConfig[] {
  const servers: McpServerConfig[] = [];
  const sectionRe = /^\[mcp_servers\.([^\]]+)\]/;
  const keyValueRe = /^(\w+)\s*=\s*(.+)$/;

  let currentName: string | null = null;
  let currentTools: string[] | undefined;

  const flush = () => {
    if (currentName != null) {
      const config: McpServerConfig = {
        name: currentName,
        estimatedTokens: 0,
        ...(currentTools !== undefined ? { toolCount: currentTools.length } : {}),
      };
      const { count } = estimateMcpTokens(config);
      servers.push({ ...config, estimatedTokens: count });
    }
    currentName = null;
    currentTools = undefined;
  };

  for (const line of toml.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || trimmed === "") continue;

    const sectionMatch = sectionRe.exec(trimmed);
    if (sectionMatch != null) {
      flush();
      currentName = sectionMatch[1]!;
      continue;
    }

    if (currentName == null) continue;

    const kvMatch = keyValueRe.exec(trimmed);
    if (kvMatch == null) continue;

    const key = kvMatch[1]!;
    const raw = kvMatch[2]!.trim();

    if (key === "tools") {
      // Parse inline array: ["tool1", "tool2"]
      const items = raw.match(/"([^"]+)"/g);
      currentTools = items != null ? items.map((s) => s.slice(1, -1)) : [];
    }
  }

  flush();
  return servers;
}

function loadMcpServers(projectRoot: string): McpServerConfig[] {
  const tomlPath = join(projectRoot, ".codex", "config.toml");
  if (!existsSync(tomlPath)) return [];

  try {
    const raw = readFileSync(tomlPath, "utf8");
    return parseMcpFromToml(raw);
  } catch {
    process.stderr.write(
      `[instrlint] Warning: could not parse MCP config in ${tomlPath}, skipping\n`,
    );
    return [];
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

export function loadCodexProject(projectRoot: string): ParsedInstructions {
  const rootFilePath = join(projectRoot, "AGENTS.md");
  const rootFile: InstructionFile = existsSync(rootFilePath)
    ? (safeParseFile(rootFilePath) ?? emptyFile(rootFilePath))
    : emptyFile(rootFilePath);

  const skills = loadSkills(projectRoot);
  const mcpServers = loadMcpServers(projectRoot);

  return {
    tool: "codex",
    rootFile,
    rules: [],
    skills,
    subFiles: [],
    mcpServers,
  };
}
