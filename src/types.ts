// ─── Primitive type aliases ────────────────────────────────────────────────

export type ToolType = 'claude-code' | 'codex' | 'cursor' | 'unknown';

export type TokenMethod = 'measured' | 'estimated';

export type Locale = 'en' | 'zh-TW';

export type Severity = 'critical' | 'warning' | 'info';

export type FindingCategory =
  | 'budget'
  | 'dead-rule'
  | 'contradiction'
  | 'stale-ref'
  | 'duplicate'
  | 'structure';

// ─── Parsed content ────────────────────────────────────────────────────────

export interface ParsedLine {
  lineNumber: number;
  text: string;
  type: 'rule' | 'heading' | 'comment' | 'blank' | 'code' | 'other';
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
}

export interface FileTokenEntry {
  path: string;
  tokenCount: number;
  tokenMethod: TokenMethod;
}

export interface BudgetSummary {
  totalTokens: number;
  fileBreakdown: FileTokenEntry[];
  mcpTokens: number;
  /** Estimated tokens remaining for actual work in the context window */
  availableTokens: number;
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
  locale: Locale;
  tokenMethod: TokenMethod;
  findings: Finding[];
  budget: BudgetSummary;
  actionPlan: ActionItem[];
}
