import { describe, it, expect } from "vitest";
import {
  calculateScore,
  buildActionPlan,
  gradeFromScore,
} from "../../src/core/scorer.js";
import type { BudgetSummary, Finding } from "../../src/types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyBudget(totalBaseline = 0): BudgetSummary {
  return {
    systemPromptTokens: 12_000,
    rootFileTokens: totalBaseline,
    rootFileMethod: "estimated",
    rulesTokens: 0,
    rulesMethod: "estimated",
    skillsTokens: 0,
    skillsMethod: "estimated",
    subFilesTokens: 0,
    subFilesMethod: "estimated",
    mcpTokens: 0,
    totalBaseline,
    availableTokens: 200_000 - totalBaseline,
    fileBreakdown: [],
    tokenMethod: "estimated",
  };
}

function makeFindings(
  severities: Array<"critical" | "warning" | "info">,
): Finding[] {
  return severities.map((severity, i) => ({
    severity,
    category: "budget" as const,
    file: "CLAUDE.md",
    line: i + 1,
    messageKey: "test",
    suggestion: `Fix issue ${i + 1}`,
    autoFixable: false,
  }));
}

// ─── gradeFromScore ────────────────────────────────────────────────────────────

describe("gradeFromScore", () => {
  it("A for 90-100", () => {
    expect(gradeFromScore(100)).toBe("A");
    expect(gradeFromScore(90)).toBe("A");
  });

  it("B for 80-89", () => {
    expect(gradeFromScore(89)).toBe("B");
    expect(gradeFromScore(80)).toBe("B");
  });

  it("C for 70-79", () => {
    expect(gradeFromScore(79)).toBe("C");
    expect(gradeFromScore(70)).toBe("C");
  });

  it("D for 60-69", () => {
    expect(gradeFromScore(69)).toBe("D");
    expect(gradeFromScore(60)).toBe("D");
  });

  it("F for below 60", () => {
    expect(gradeFromScore(59)).toBe("F");
    expect(gradeFromScore(0)).toBe("F");
  });
});

// ─── calculateScore ───────────────────────────────────────────────────────────

describe("calculateScore", () => {
  it("0 findings and zero budget → score 100, grade A", () => {
    const { score, grade } = calculateScore([], emptyBudget());
    expect(score).toBe(100);
    expect(grade).toBe("A");
  });

  it("each critical deducts 10 points", () => {
    const { score } = calculateScore(makeFindings(["critical"]), emptyBudget());
    expect(score).toBe(90);
  });

  it("each warning deducts 5 points", () => {
    const { score } = calculateScore(makeFindings(["warning"]), emptyBudget());
    expect(score).toBe(95);
  });

  it("each info deducts 1 point", () => {
    const { score } = calculateScore(makeFindings(["info"]), emptyBudget());
    expect(score).toBe(99);
  });

  it("critical deductions capped at 40", () => {
    const findings = makeFindings(Array(10).fill("critical") as "critical"[]);
    const { score } = calculateScore(findings, emptyBudget());
    // 10 criticals × 10 = 100, but capped at 40
    expect(score).toBe(60);
  });

  it("warning deductions capped at 30", () => {
    const findings = makeFindings(Array(10).fill("warning") as "warning"[]);
    const { score } = calculateScore(findings, emptyBudget());
    // 10 warnings × 5 = 50, but capped at 30
    expect(score).toBe(70);
  });

  it("info deductions capped at 10", () => {
    const findings = makeFindings(Array(20).fill("info") as "info"[]);
    const { score } = calculateScore(findings, emptyBudget());
    // 20 info × 1 = 20, but capped at 10
    expect(score).toBe(90);
  });

  it("score never goes below 0", () => {
    const findings = makeFindings(
      Array(10).fill("critical") as "critical"[],
    ).concat(makeFindings(Array(10).fill("warning") as "warning"[]));
    const { score } = calculateScore(findings, emptyBudget());
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("budget > 25% of context → -5 points", () => {
    // 200_000 * 0.3 = 60_000 tokens baseline
    const budget = emptyBudget(60_000);
    const { score } = calculateScore([], budget);
    expect(score).toBe(95);
  });

  it("budget > 50% of context → -15 points", () => {
    const budget = emptyBudget(110_000);
    const { score } = calculateScore([], budget);
    expect(score).toBe(85);
  });

  it("grade reflects score", () => {
    const { grade } = calculateScore(
      makeFindings(["critical", "critical"]),
      emptyBudget(),
    );
    // 100 - 20 = 80 → B
    expect(grade).toBe("B");
  });
});

// ─── buildActionPlan ──────────────────────────────────────────────────────────

describe("buildActionPlan", () => {
  it("empty findings → empty plan", () => {
    expect(buildActionPlan([])).toHaveLength(0);
  });

  it("deduplicates findings by suggestion text", () => {
    const findings = makeFindings(["critical", "critical"]);
    findings[1]!.suggestion = findings[0]!.suggestion; // same suggestion
    const plan = buildActionPlan(findings);
    expect(plan).toHaveLength(1);
  });

  it("sorts critical before warning before info", () => {
    const findings = makeFindings(["info", "critical", "warning"]);
    findings[0]!.suggestion = "info suggestion";
    findings[1]!.suggestion = "critical suggestion";
    findings[2]!.suggestion = "warning suggestion";
    const plan = buildActionPlan(findings);
    expect(plan[0]!.priority).toBe(1); // critical
    expect(plan[1]!.priority).toBe(2); // warning
    expect(plan[2]!.priority).toBe(3); // info
  });

  it("action item includes description and category", () => {
    const f: Finding = {
      severity: "warning",
      category: "dead-rule",
      file: "CLAUDE.md",
      suggestion: "Remove redundant rule",
      messageKey: "test",
      autoFixable: true,
    };
    const plan = buildActionPlan([f]);
    expect(plan[0]!.description).toBe("Remove redundant rule");
    expect(plan[0]!.category).toBe("dead-rule");
  });
});
