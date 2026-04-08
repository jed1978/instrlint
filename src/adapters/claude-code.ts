import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { parseInstructionFile, parseYamlFrontmatter } from "../core/parser.js";
import {
  countTokens,
  estimateMcpTokens,
} from "../detectors/token-estimator.js";
import type {
  InstructionFile,
  McpServerConfig,
  ParsedInstructions,
  RuleFile,
  SkillFile,
} from "../types.js";

// ─── Helpers ───────────────────────────────────────────────────────────────

function withTokens(file: InstructionFile): InstructionFile {
  const raw = (() => {
    try {
      return readFileSync(file.path, "utf8");
    } catch {
      return "";
    }
  })();
  const { count, method } = countTokens(raw);
  return { ...file, tokenCount: count, tokenMethod: method };
}

function safeParseFile(filePath: string): InstructionFile | null {
  try {
    const file = parseInstructionFile(filePath);
    return withTokens(file);
  } catch {
    process.stderr.write(
      `[instrlint] Warning: could not read ${filePath}, skipping\n`,
    );
    return null;
  }
}

// ─── Root file discovery ───────────────────────────────────────────────────

function findRootFile(projectRoot: string): string | null {
  const candidates = [
    join(projectRoot, "CLAUDE.md"),
    join(projectRoot, ".claude", "CLAUDE.md"),
  ];
  return candidates.find(existsSync) ?? null;
}

// ─── Rules ────────────────────────────────────────────────────────────────

function loadRules(projectRoot: string): RuleFile[] {
  const rulesDir = join(projectRoot, ".claude", "rules");
  if (!existsSync(rulesDir)) return [];

  const rules: RuleFile[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(rulesDir).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }

  for (const filename of entries) {
    const filePath = join(rulesDir, filename);
    try {
      const raw = readFileSync(filePath, "utf8");
      const { paths, globs, body } = parseYamlFrontmatter(raw);
      const baseFile = parseInstructionFile(filePath);
      const { count, method } = countTokens(body);
      rules.push({
        ...baseFile,
        tokenCount: count,
        tokenMethod: method,
        ...(paths != null ? { paths } : {}),
        ...(globs != null ? { globs } : {}),
      });
    } catch {
      process.stderr.write(
        `[instrlint] Warning: could not parse rule ${filePath}, skipping\n`,
      );
    }
  }

  return rules;
}

// ─── Skills ───────────────────────────────────────────────────────────────

function loadSkills(projectRoot: string): SkillFile[] {
  const skillsDir = join(projectRoot, ".claude", "skills");
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

// ─── Sub-directory CLAUDE.md files ────────────────────────────────────────

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  ".claude",
  ".turbo",
  "coverage",
  "tests",
  "test",
  "__tests__",
  "spec",
]);

function findSubClaudeFiles(
  dir: string,
  projectRoot: string,
  depth = 0,
): InstructionFile[] {
  if (depth > 10) return []; // guard against infinite recursion
  const results: InstructionFile[] = [];

  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);

    try {
      const stat = statSync(full);
      if (stat.isDirectory()) {
        results.push(...findSubClaudeFiles(full, projectRoot, depth + 1));
      } else if (entry === "CLAUDE.md") {
        // Skip the project root CLAUDE.md itself
        if (relative(projectRoot, full) === "CLAUDE.md") continue;
        const parsed = safeParseFile(full);
        if (parsed != null) results.push(parsed);
      }
    } catch {
      // skip inaccessible entries
    }
  }

  return results;
}

// ─── MCP servers ──────────────────────────────────────────────────────────

interface McpServerEntry {
  command?: string;
  args?: string[];
  tools?: unknown[];
}

function parseMcpServers(projectRoot: string): McpServerConfig[] {
  const candidates = [
    join(projectRoot, ".claude", "settings.json"),
    join(projectRoot, ".claude", "settings.local.json"),
  ];

  const servers: McpServerConfig[] = [];

  for (const settingsPath of candidates) {
    if (!existsSync(settingsPath)) continue;
    try {
      const raw = readFileSync(settingsPath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (
        parsed == null ||
        typeof parsed !== "object" ||
        !("mcpServers" in parsed)
      ) {
        continue;
      }
      const mcpServers = (
        parsed as { mcpServers: Record<string, McpServerEntry> }
      ).mcpServers;
      for (const [name, entry] of Object.entries(mcpServers)) {
        const toolCount = Array.isArray(entry.tools)
          ? entry.tools.length
          : undefined;
        const config: McpServerConfig = {
          name,
          estimatedTokens: 0,
          ...(toolCount !== undefined ? { toolCount } : {}),
        };
        const { count } = estimateMcpTokens(config);
        servers.push({ ...config, estimatedTokens: count });
      }
    } catch {
      process.stderr.write(
        `[instrlint] Warning: could not parse MCP config in ${settingsPath}, skipping\n`,
      );
    }
  }

  return servers;
}

// ─── Public API ────────────────────────────────────────────────────────────

export function loadClaudeCodeProject(projectRoot: string): ParsedInstructions {
  // Root file
  const rootFilePath = findRootFile(projectRoot);
  const rootFile: InstructionFile =
    rootFilePath != null
      ? (safeParseFile(rootFilePath) ?? emptyFile(rootFilePath))
      : emptyFile(join(projectRoot, "CLAUDE.md"));

  // Rule files
  const rules = loadRules(projectRoot);

  // Skill files
  const skills = loadSkills(projectRoot);

  // Sub-directory CLAUDE.md files (skip root)
  const subFiles = findSubClaudeFiles(projectRoot, projectRoot);

  // MCP servers
  const mcpServers = parseMcpServers(projectRoot);

  return {
    tool: "claude-code",
    rootFile,
    rules,
    skills,
    subFiles,
    mcpServers,
  };
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
