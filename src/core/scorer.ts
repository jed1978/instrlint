import type { ActionItem, BudgetSummary, Finding } from "../types.js";

type Grade = "A" | "B" | "C" | "D" | "F";

const CONTEXT_WINDOW = 200_000;

// ─── Scoring weights ───────────────────────────────────────────────────────────

const CRITICAL_DEDUCTION = 10;
const WARNING_DEDUCTION = 5;
const INFO_DEDUCTION = 1;

const MAX_CRITICAL_DEDUCTION = 40;
const MAX_WARNING_DEDUCTION = 30;
const MAX_INFO_DEDUCTION = 10;
const MAX_ROOT_FILE_PENALTY = 30;
const MAX_BUDGET_DEDUCTION = 30;

// ─── Public API ───────────────────────────────────────────────────────────────

export function gradeFromScore(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function calculateScore(
  findings: Finding[],
  budget: BudgetSummary,
): { score: number; grade: Grade } {
  const criticals = findings.filter((f) => f.severity === "critical").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const infos = findings.filter((f) => f.severity === "info").length;

  const criticalDeduction = Math.min(
    criticals * CRITICAL_DEDUCTION,
    MAX_CRITICAL_DEDUCTION,
  );
  const warningDeduction = Math.min(
    warnings * WARNING_DEDUCTION,
    MAX_WARNING_DEDUCTION,
  );
  const infoDeduction = Math.min(infos * INFO_DEDUCTION, MAX_INFO_DEDUCTION);

  // Root file length penalty — proportional beyond each threshold
  // 201-300: -5, 301-400: -8, 401-500: -10, 501-600: -15, 601-700: -20, ...
  const rootLines = budget.rootFileLines;
  let rootFilePenalty = 0;
  if (rootLines > 400) {
    rootFilePenalty = 10 + Math.floor((rootLines - 400) / 100) * 5;
  } else if (rootLines > 200) {
    rootFilePenalty = 5 + Math.floor((rootLines - 200) / 100) * 3;
  }
  rootFilePenalty = Math.min(rootFilePenalty, MAX_ROOT_FILE_PENALTY);

  // Budget penalty — continuous beyond 25% of context window
  // 25%: -5, 50%: -15, 75%: -25, capped at 30
  const baselinePct = budget.totalBaseline / CONTEXT_WINDOW;
  let budgetDeduction = 0;
  if (baselinePct > 0.25) {
    budgetDeduction = 5 + Math.floor((baselinePct - 0.25) * 40);
  }
  budgetDeduction = Math.min(budgetDeduction, MAX_BUDGET_DEDUCTION);

  const score = Math.max(
    0,
    100 -
      criticalDeduction -
      warningDeduction -
      infoDeduction -
      rootFilePenalty -
      budgetDeduction,
  );
  return { score, grade: gradeFromScore(score) };
}

export function buildActionPlan(findings: Finding[]): ActionItem[] {
  const priorityOf = (f: Finding): number => {
    if (f.severity === "critical") return 1;
    if (f.severity === "warning") return 2;
    return 3;
  };

  const seen = new Set<string>();
  return findings
    .filter((f) => {
      if (seen.has(f.suggestion)) return false;
      seen.add(f.suggestion);
      return true;
    })
    .map((f) => ({
      priority: priorityOf(f),
      description: f.suggestion,
      category: f.category,
    }))
    .sort((a, b) => a.priority - b.priority);
}
