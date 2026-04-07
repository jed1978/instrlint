// ─── Primitive type aliases ────────────────────────────────────────────────

export type ToolType = "claude-code" | "codex" | "cursor" | "unknown";

export type TokenMethod = "measured" | "estimated";

export type Locale = "en" | "zh-TW";

export type Severity = "critical" | "warning" | "info";

export type FindingCategory =
  | "budget"
  | "dead-rule"
  | "contradiction"
  | "stale-ref"
  | "duplicate"
  | "structure";

// ─── Parsed content ────────────────────────────────────────────────────────

export interface ParsedLine {
  lineNumber: number;
  text: string;
  type: "rule" | "heading" | "comment" | "blank" | "code" | "other";
  keywords: string[];
  referencedPaths: string[];
}

export interface InstructionFile {
  path: string;
  lines: ParsedLine[];
  lineCount: number;
  tokenCount: number;
  tokenMethod: TokenMethod;
}

/** A rule file from .claude/rules/*.md — may have frontmatter path filters */
export interface RuleFile extends InstructionFile {
  /** From frontmatter `paths:` field */
  paths?: string[];
  /** From frontmatter `globs:` field */
  globs?: string[];
}

/** A skill file from .claude/skills/<name>/SKILL.md */
export interface SkillFile extends InstructionFile {
  skillName: string;
}

export interface McpServerConfig {
  name: string;
  /** Number of tools exposed by this server, if known */
  toolCount?: number;
  /** Estimated tokens consumed by this server's tool definitions */
  estimatedTokens: number;
}

// ─── Top-level parsed representation ──────────────────────────────────────

export interface ParsedInstructions {
  tool: ToolType;
  rootFile: InstructionFile;
  rules: RuleFile[];
  skills: SkillFile[];
  /** CLAUDE.md files in sub-directories */
  subFiles: InstructionFile[];
  mcpServers: McpServerConfig[];
}

// ─── Analysis output ───────────────────────────────────────────────────────

export interface Finding {
  severity: Severity;
  category: FindingCategory;
  /** Relative file path */
  file: string;
  /** 1-based line number, if applicable */
  line?: number;
  /** i18n key, e.g. 'findings.deadRule.configOverlap' */
  messageKey: string;
  /** Interpolation params for the i18n message */
  messageParams?: Record<string, string>;
  /** Human-readable suggestion (goes through t()) */
  suggestion: string;
  autoFixable: boolean;
  /**
   * Optional verification verdict from a host LLM (Claude Code, Codex, etc.).
   * Populated by `applyVerdicts()` after the host agent reads candidates.json
   * and writes verdicts.json. Findings with `verdict === 'rejected'` are
   * filtered out before reporting; `confirmed` findings are tagged in the UI.
   */
  verification?: {
    verdict: "confirmed" | "rejected" | "uncertain";
    reason: string;
  };
}

export interface FileTokenEntry {
  path: string;
  tokenCount: number;
  tokenMethod: TokenMethod;
}

export interface BudgetSummary {
  /** Fixed estimate for the system prompt injected by Claude Code */
  systemPromptTokens: number;
  rootFileTokens: number;
  rootFileLines: number;
  rootFileMethod: TokenMethod;
  rulesTokens: number;
  rulesMethod: TokenMethod;
  skillsTokens: number;
  skillsMethod: TokenMethod;
  subFilesTokens: number;
  subFilesMethod: TokenMethod;
  mcpTokens: number;
  /** Sum of all above */
  totalBaseline: number;
  /** 200K context window minus totalBaseline */
  availableTokens: number;
  /** Per-file breakdown */
  fileBreakdown: FileTokenEntry[];
  /** Overall method: 'measured' only if every file used tiktoken */
  tokenMethod: TokenMethod;
}

export interface ActionItem {
  /** Lower = higher priority */
  priority: number;
  description: string;
  category: FindingCategory;
  /** Approximate token savings if the issue is resolved */
  estimatedSavings?: number;
}

export interface HealthReport {
  project: string;
  tool: ToolType;
  score: number;
  /** Letter grade derived from score: A(90+) B(80+) C(70+) D(60+) F(<60) */
  grade: string;
  locale: Locale;
  tokenMethod: TokenMethod;
  findings: Finding[];
  budget: BudgetSummary;
  actionPlan: ActionItem[];
  /** Number of findings filtered out by LLM verdicts (verdict === 'rejected'). */
  rejectedByVerification?: number;
}
