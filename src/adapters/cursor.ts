import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
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

// ─── Root file ─────────────────────────────────────────────────────────────

function findRootFile(projectRoot: string): string | null {
  const cursorRules = join(projectRoot, ".cursorrules");
  if (existsSync(cursorRules)) return cursorRules;
  return null;
}

// ─── Rules from .cursor/rules/*.md ────────────────────────────────────────

function loadRules(projectRoot: string): RuleFile[] {
  const rulesDir = join(projectRoot, ".cursor", "rules");
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
      // Cursor uses globs: in frontmatter (not paths:)
      const { globs, body } = parseYamlFrontmatter(raw);
      const baseFile = parseInstructionFile(filePath);
      const { count, method } = countTokens(body);
      rules.push({
        ...baseFile,
        tokenCount: count,
        tokenMethod: method,
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

// ─── MCP servers from .cursor/mcp.json ────────────────────────────────────

interface CursorMcpEntry {
  command?: string;
  args?: string[];
  tools?: unknown[];
}

function loadMcpServers(projectRoot: string): McpServerConfig[] {
  const mcpPath = join(projectRoot, ".cursor", "mcp.json");
  if (!existsSync(mcpPath)) return [];

  try {
    const raw = readFileSync(mcpPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed == null ||
      typeof parsed !== "object" ||
      !("mcpServers" in parsed)
    ) {
      return [];
    }
    const mcpServers = (
      parsed as { mcpServers: Record<string, CursorMcpEntry> }
    ).mcpServers;
    return Object.entries(mcpServers).map(([name, entry]) => {
      const toolCount = Array.isArray(entry.tools) ? entry.tools.length : undefined;
      const config: McpServerConfig = {
        name,
        estimatedTokens: 0,
        ...(toolCount !== undefined ? { toolCount } : {}),
      };
      const { count } = estimateMcpTokens(config);
      return { ...config, estimatedTokens: count };
    });
  } catch {
    process.stderr.write(
      `[instrlint] Warning: could not parse MCP config in ${mcpPath}, skipping\n`,
    );
    return [];
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

export function loadCursorProject(projectRoot: string): ParsedInstructions {
  const rootFilePath = findRootFile(projectRoot);
  const rootFile: InstructionFile =
    rootFilePath != null
      ? (safeParseFile(rootFilePath) ?? emptyFile(rootFilePath))
      : emptyFile(join(projectRoot, ".cursorrules"));

  const rules = loadRules(projectRoot);
  const mcpServers = loadMcpServers(projectRoot);

  return {
    tool: "cursor",
    rootFile,
    rules,
    skills: [],
    subFiles: [],
    mcpServers,
  };
}
