import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { reportJson, reportMarkdown, printCombinedTerminal } from "../../src/core/reporter.js";
import { ensureInitialized } from "../../src/detectors/token-estimator.js";
import type { BudgetSummary, Finding, HealthReport } from "../../src/types.js";

beforeAll(async () => {
  await ensureInitialized();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Fixture ──────────────────────────────────────────────────────────────────

function makeReport(overrides: Partial<HealthReport> = {}): HealthReport {
  const budget: BudgetSummary = {
    systemPromptTokens: 12_000,
    rootFileTokens: 1_500,
    rootFileMethod: "estimated",
    rulesTokens: 0,
    rulesMethod: "estimated",
    skillsTokens: 0,
    skillsMethod: "estimated",
    subFilesTokens: 0,
    subFilesMethod: "estimated",
    mcpTokens: 0,
    totalBaseline: 13_500,
    availableTokens: 186_500,
    fileBreakdown: [],
    tokenMethod: "estimated",
  };

  const findings: Finding[] = [
    {
      severity: "critical",
      category: "contradiction",
      file: "CLAUDE.md",
      line: 47,
      messageKey: "structure.contradiction",
      suggestion: 'Contradicting rules: "Use exceptions..." (line 47) conflicts with line 109.',
      autoFixable: false,
    },
    {
      severity: "warning",
      category: "dead-rule",
      file: "CLAUDE.md",
      line: 16,
      messageKey: "deadRule.configOverlap",
      suggestion: "Always use TypeScript strict mode is already enforced by tsconfig.json (compilerOptions.strict: true).",
      autoFixable: true,
    },
    {
      severity: "info",
      category: "structure",
      file: "CLAUDE.md",
      line: 86,
      messageKey: "structure.scopeHook",
      suggestion: 'Rule at line 86 could be a git hook: "Never commit API keys..."',
      autoFixable: false,
    },
  ];

  return {
    project: "my-project",
    tool: "claude-code",
    score: 84,
    grade: "B",
    locale: "en",
    tokenMethod: "estimated",
    findings,
    budget,
    actionPlan: [
      { priority: 1, description: findings[0]!.suggestion, category: "contradiction" },
      { priority: 2, description: findings[1]!.suggestion, category: "dead-rule" },
      { priority: 3, description: findings[2]!.suggestion, category: "structure" },
    ],
    ...overrides,
  };
}

// ─── reportJson ───────────────────────────────────────────────────────────────

describe("reportJson", () => {
  it("returns valid JSON", () => {
    const json = reportJson(makeReport());
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("includes required top-level keys", () => {
    const parsed = JSON.parse(reportJson(makeReport()));
    expect(parsed).toHaveProperty("project");
    expect(parsed).toHaveProperty("score");
    expect(parsed).toHaveProperty("grade");
    expect(parsed).toHaveProperty("findings");
    expect(parsed).toHaveProperty("budget");
    expect(parsed).toHaveProperty("actionPlan");
  });

  it("score and grade match report values", () => {
    const report = makeReport({ score: 75, grade: "C" });
    const parsed = JSON.parse(reportJson(report));
    expect(parsed.score).toBe(75);
    expect(parsed.grade).toBe("C");
  });

  it("findings array length matches report", () => {
    const report = makeReport();
    const parsed = JSON.parse(reportJson(report));
    expect(parsed.findings).toHaveLength(report.findings.length);
  });
});

// ─── reportMarkdown ───────────────────────────────────────────────────────────

describe("reportMarkdown", () => {
  it("starts with an H1 heading", () => {
    const md = reportMarkdown(makeReport());
    expect(md.startsWith("# instrlint Health Report")).toBe(true);
  });

  it("contains project name", () => {
    const md = reportMarkdown(makeReport({ project: "foobar" }));
    expect(md).toContain("foobar");
  });

  it("contains score and grade", () => {
    const md = reportMarkdown(makeReport({ score: 84, grade: "B" }));
    expect(md).toContain("84");
    expect(md).toContain("B");
  });

  it("contains Summary section with severity counts", () => {
    const md = reportMarkdown(makeReport());
    expect(md).toContain("## Summary");
    expect(md).toContain("Critical");
    expect(md).toContain("Warning");
  });

  it("contains Action Plan section", () => {
    const md = reportMarkdown(makeReport());
    expect(md).toContain("## Action Plan");
  });

  it("contains instrlint attribution footer", () => {
    const md = reportMarkdown(makeReport());
    expect(md).toContain("instrlint");
    expect(md).toContain("---");
  });
});

// ─── printCombinedTerminal ─────────────────────────────────────────────────────

describe("printCombinedTerminal", () => {
  it("outputs score to console.log", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    printCombinedTerminal(makeReport());
    const allOutput = logSpy.mock.calls.flat().join("\n");
    expect(allOutput).toContain("84");
  });

  it("outputs grade to console.log", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    printCombinedTerminal(makeReport({ grade: "B" }));
    const allOutput = logSpy.mock.calls.flat().join("\n");
    expect(allOutput).toContain("B");
  });

  it("outputs project name", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    printCombinedTerminal(makeReport({ project: "testproject" }));
    const allOutput = logSpy.mock.calls.flat().join("\n");
    expect(allOutput).toContain("testproject");
  });

  it("outputs ACTION PLAN section when findings exist", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    printCombinedTerminal(makeReport());
    const allOutput = logSpy.mock.calls.flat().join("\n");
    expect(allOutput).toContain("ACTION PLAN");
  });

  it("outputs perfect score message when no findings", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    printCombinedTerminal(
      makeReport({ findings: [], actionPlan: [], score: 100, grade: "A" }),
    );
    const allOutput = logSpy.mock.calls.flat().join("\n");
    expect(allOutput).toContain("Perfect score");
  });
});
