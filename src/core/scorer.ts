import type { ActionItem, BudgetSummary, Finding } from '../types.js';

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

const CONTEXT_WINDOW = 200_000;

// ─── Scoring weights ───────────────────────────────────────────────────────────

const CRITICAL_DEDUCTION = 10;
const WARNING_DEDUCTION = 5;
const INFO_DEDUCTION = 1;

const MAX_CRITICAL_DEDUCTION = 40;
const MAX_WARNING_DEDUCTION = 30;
const MAX_INFO_DEDUCTION = 10;

// ─── Public API ───────────────────────────────────────────────────────────────

export function gradeFromScore(score: number): Grade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export function calculateScore(
  findings: Finding[],
  budget: BudgetSummary,
): { score: number; grade: Grade } {
  const criticals = findings.filter((f) => f.severity === 'critical').length;
  const warnings = findings.filter((f) => f.severity === 'warning').length;
  const infos = findings.filter((f) => f.severity === 'info').length;

  const criticalDeduction = Math.min(criticals * CRITICAL_DEDUCTION, MAX_CRITICAL_DEDUCTION);
  const warningDeduction = Math.min(warnings * WARNING_DEDUCTION, MAX_WARNING_DEDUCTION);
  const infoDeduction = Math.min(infos * INFO_DEDUCTION, MAX_INFO_DEDUCTION);

  // Budget penalty based on fraction of total context window consumed
  const baselinePct = budget.totalBaseline / CONTEXT_WINDOW;
  let budgetDeduction = 0;
  if (baselinePct > 0.5) budgetDeduction = 15;
  else if (baselinePct > 0.25) budgetDeduction = 5;

  const score = Math.max(
    0,
    100 - criticalDeduction - warningDeduction - infoDeduction - budgetDeduction,
  );
  return { score, grade: gradeFromScore(score) };
}

export function buildActionPlan(findings: Finding[]): ActionItem[] {
  const priorityOf = (f: Finding): number => {
    if (f.severity === 'critical') return 1;
    if (f.severity === 'warning') return 2;
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
