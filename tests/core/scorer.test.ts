import { describe, it, expect } from "vitest";
import {
  calculateScore,
  buildActionPlan,
  gradeFromScore,
} from "../../src/core/scorer.js";
import type { BudgetSummary, Finding } from "../../src/types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyBudget(totalBaseline = 0, rootFileLines = 0): BudgetSummary {
  return {
    systemPromptTokens: 12_000,
    rootFileTokens: totalBaseline,
    rootFileLines,
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

  it("budget at 31% of context → continuous penalty", () => {
    // 200_000 * 0.31 = 62_000 — penalty = 5 + floor((0.31 - 0.25) * 40) = 5 + floor(2.4) = 7
    const budget = emptyBudget(62_000);
    const { score } = calculateScore([], budget);
    expect(score).toBe(93);
  });

  it("budget at 55% of context → continuous penalty", () => {
    // 200_000 * 0.55 = 110_000 — penalty = 5 + floor((0.55 - 0.25) * 40) = 5 + 12 = 17
    const budget = emptyBudget(110_000);
    const { score } = calculateScore([], budget);
    expect(score).toBe(83);
  });

  it("budget at exactly 25% → no penalty", () => {
    const budget = emptyBudget(50_000);
    const { score } = calculateScore([], budget);
    expect(score).toBe(100);
  });

  it("budget penalty capped at 30", () => {
    // 100% baseline → penalty = 5 + floor((1.0 - 0.25) * 40) = 5 + 30 = 35, capped at 30
    const budget = emptyBudget(200_000);
    const { score } = calculateScore([], budget);
    expect(score).toBe(70);
  });

  it("root file 617 lines → proportional penalty (-20)", () => {
    // 617 lines: 10 + floor((617-400)/100)*5 = 10 + floor(2.17)*5 = 10 + 10 = 20
    const budget = emptyBudget(0, 617);
    const { score } = calculateScore([], budget);
    expect(score).toBe(80);
  });

  it("root file 401 lines → minimum critical penalty (-10)", () => {
    const budget = emptyBudget(0, 401);
    const { score } = calculateScore([], budget);
    expect(score).toBe(90);
  });

  it("root file 800 lines → penalty capped at 30", () => {
    // 800 lines: 10 + floor((800-400)/100)*5 = 10 + 20 = 30 (at cap)
    const budget = emptyBudget(0, 800);
    const { score } = calculateScore([], budget);
    expect(score).toBe(70);
  });

  it("root file 250 lines → small warning penalty (-8)", () => {
    // 250 lines: 5 + floor((250-200)/100)*3 = 5 + 0 = 5
    const budget = emptyBudget(0, 250);
    const { score } = calculateScore([], budget);
    expect(score).toBe(95);
  });

  it("root file 200 lines → no penalty", () => {
    const budget = emptyBudget(0, 200);
    const { score } = calculateScore([], budget);
    expect(score).toBe(100);
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
