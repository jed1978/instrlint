import type {
  BudgetSummary,
  FileTokenEntry,
  Finding,
  ParsedInstructions,
  TokenMethod,
} from '../types.js';

const CONTEXT_WINDOW = 200_000;
const SYSTEM_PROMPT_TOKENS = 12_000;
const WARN_LINE_THRESHOLD = 200;
const CRITICAL_LINE_THRESHOLD = 400;
const WARN_BASELINE_PCT = 0.25; // 25% = 50K
const MCP_INFO_THRESHOLD = 10_000;

function sumTokens(
  items: Array<{ tokenCount: number; tokenMethod: TokenMethod }>,
): { tokens: number; method: TokenMethod } {
  if (items.length === 0) return { tokens: 0, method: 'measured' };
  const tokens = items.reduce((acc, f) => acc + f.tokenCount, 0);
  const method: TokenMethod = items.every((f) => f.tokenMethod === 'measured')
    ? 'measured'
    : 'estimated';
  return { tokens, method };
}

export interface BudgetResult {
  findings: Finding[];
  summary: BudgetSummary;
}

export function analyzeBudget(instructions: ParsedInstructions): BudgetResult {
  const findings: Finding[] = [];

  // ── Root file ────────────────────────────────────────────────────────────
  const rootFileTokens = instructions.rootFile.tokenCount;
  const rootFileMethod = instructions.rootFile.tokenMethod;
  const rootLines = instructions.rootFile.lineCount;

  if (rootLines > CRITICAL_LINE_THRESHOLD) {
    findings.push({
      severity: 'critical',
      category: 'budget',
      file: instructions.rootFile.path,
      messageKey: 'budget.rootFileCritical',
      messageParams: { lines: String(rootLines) },
      suggestion: `Root instruction file is ${rootLines} lines — agent compliance drops significantly above 200 lines`,
      autoFixable: false,
    });
  } else if (rootLines > WARN_LINE_THRESHOLD) {
    findings.push({
      severity: 'warning',
      category: 'budget',
      file: instructions.rootFile.path,
      messageKey: 'budget.rootFileWarning',
      messageParams: { lines: String(rootLines) },
      suggestion: `Root instruction file is ${rootLines} lines (recommended: < 200)`,
      autoFixable: false,
    });
  }

  // ── Rules ─────────────────────────────────────────────────────────────────
  const { tokens: rulesTokens, method: rulesMethod } = sumTokens(instructions.rules);

  // ── Skills ────────────────────────────────────────────────────────────────
  const { tokens: skillsTokens, method: skillsMethod } = sumTokens(instructions.skills);

  // ── Sub-files ─────────────────────────────────────────────────────────────
  const { tokens: subFilesTokens, method: subFilesMethod } = sumTokens(
    instructions.subFiles,
  );

  // ── MCP servers ───────────────────────────────────────────────────────────
  const mcpTokens = instructions.mcpServers.reduce(
    (acc, s) => acc + s.estimatedTokens,
    0,
  );

  for (const server of instructions.mcpServers) {
    if (server.estimatedTokens > MCP_INFO_THRESHOLD) {
      findings.push({
        severity: 'info',
        category: 'budget',
        file: '.claude/settings.json',
        messageKey: 'budget.mcpLargeServer',
        messageParams: {
          name: server.name,
          tokens: server.estimatedTokens.toLocaleString('en'),
        },
        suggestion: `MCP server '${server.name}' consumes ~${server.estimatedTokens.toLocaleString('en')} tokens`,
        autoFixable: false,
      });
    }
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalBaseline =
    SYSTEM_PROMPT_TOKENS +
    rootFileTokens +
    rulesTokens +
    skillsTokens +
    subFilesTokens +
    mcpTokens;

  const availableTokens = CONTEXT_WINDOW - totalBaseline;

  const pct = totalBaseline / CONTEXT_WINDOW;
  if (pct > WARN_BASELINE_PCT) {
    findings.push({
      severity: 'warning',
      category: 'budget',
      file: instructions.rootFile.path,
      messageKey: 'budget.baselineHigh',
      messageParams: { pct: Math.round(pct * 100).toString() },
      suggestion: `Baseline context consumption is ${Math.round(pct * 100)}% of window`,
      autoFixable: false,
    });
  }

  // Overall method: measured only if all file groups are measured
  const tokenMethod: TokenMethod =
    [rootFileMethod, rulesMethod, skillsMethod, subFilesMethod].every(
      (m) => m === 'measured',
    )
      ? 'measured'
      : 'estimated';

  // File breakdown
  const fileBreakdown: FileTokenEntry[] = [
    { path: instructions.rootFile.path, tokenCount: rootFileTokens, tokenMethod: rootFileMethod },
    ...instructions.rules.map((r) => ({
      path: r.path,
      tokenCount: r.tokenCount,
      tokenMethod: r.tokenMethod,
    })),
    ...instructions.skills.map((s) => ({
      path: s.path,
      tokenCount: s.tokenCount,
      tokenMethod: s.tokenMethod,
    })),
    ...instructions.subFiles.map((f) => ({
      path: f.path,
      tokenCount: f.tokenCount,
      tokenMethod: f.tokenMethod,
    })),
  ];

  const summary: BudgetSummary = {
    systemPromptTokens: SYSTEM_PROMPT_TOKENS,
    rootFileTokens,
    rootFileMethod,
    rulesTokens,
    rulesMethod,
    skillsTokens,
    skillsMethod,
    subFilesTokens,
    subFilesMethod,
    mcpTokens,
    totalBaseline,
    availableTokens,
    fileBreakdown,
    tokenMethod,
  };

  return { findings, summary };
}
