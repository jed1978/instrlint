import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import {
  reportJson,
  reportMarkdown,
  printCombinedTerminal,
} from "../../src/core/reporter.js";
import { ensureInitialized } from "../../src/detectors/token-estimator.js";
import { initLocale } from "../../src/i18n/index.js";
import type { BudgetSummary, Finding, HealthReport } from "../../src/types.js";

beforeAll(async () => {
  await ensureInitialized();
});

beforeEach(() => {
  initLocale("en");
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
      messageParams: {
        snippet: "Use exceptions...",
        fileA: "CLAUDE.md",
        lineA: "47",
        lineB: "109",
      },
      suggestion:
        'Contradicting rules: "Use exceptions..." (CLAUDE.md line 47) conflicts with line 109.',
      autoFixable: false,
    },
    {
      severity: "warning",
      category: "dead-rule",
      file: "CLAUDE.md",
      line: 16,
      messageKey: "deadRule.configOverlap",
      messageParams: {
        rule: "Always use TypeScript strict mode",
        config: "tsconfig.json (compilerOptions.strict: true)",
      },
      suggestion:
        "Always use TypeScript strict mode is already enforced by tsconfig.json (compilerOptions.strict: true).",
      autoFixable: true,
    },
    {
      severity: "info",
      category: "structure",
      file: "CLAUDE.md",
      line: 86,
      messageKey: "structure.scopeHook",
      messageParams: {
        line: "86",
        snippet: "Never commit API keys...",
      },
      suggestion:
        'Rule at line 86 could be a git hook: "Never commit API keys..."',
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
      {
        priority: 1,
        description: findings[0]!.suggestion,
        category: "contradiction",
      },
      {
        priority: 2,
        description: findings[1]!.suggestion,
        category: "dead-rule",
      },
      {
        priority: 3,
        description: findings[2]!.suggestion,
        category: "structure",
      },
    ],
    ...overrides,
  };
}

// ─── reportJson ───────────────────────────────────────────────────────────────

describe("reportJson", () => {
  it("includes required top-level keys", () => {
    const parsed = JSON.parse(reportJson(makeReport()));
    expect(parsed).toHaveProperty("project");
    expect(parsed).toHaveProperty("score");
    expect(parsed).toHaveProperty("grade");
    expect(parsed).toHaveProperty("findings");
    expect(parsed).toHaveProperty("budget");
    expect(parsed).toHaveProperty("actionPlan");
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

  it("outputs BUDGET line with token count and percentage", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    printCombinedTerminal(makeReport());
    const allOutput = logSpy.mock.calls.flat().join("\n");
    expect(allOutput).toContain("BUDGET");
    expect(allOutput).toMatch(/\d+.*\/.*\d+.*tokens.*\d+%/);
  });

  it("outputs FINDINGS table with category rows when findings exist", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    printCombinedTerminal(makeReport());
    const allOutput = logSpy.mock.calls.flat().join("\n");
    expect(allOutput).toContain("FINDINGS");
    expect(allOutput).toContain("Contradictions");
    expect(allOutput).toContain("Dead rules");
  });

  it("outputs TOP ISSUES section when findings exist", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    printCombinedTerminal(makeReport());
    const allOutput = logSpy.mock.calls.flat().join("\n");
    expect(allOutput).toContain("TOP ISSUES");
  });

  it("top issues capped at 5 entries", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    printCombinedTerminal(makeReport());
    const calls = logSpy.mock.calls.flat().join("\n");
    // Only 3 findings in fixture — all shown, no overflow line
    expect(calls).toContain("1.");
    expect(calls).not.toContain("4.");
  });

  it("omits FINDINGS and TOP ISSUES when no findings", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    printCombinedTerminal(
      makeReport({ findings: [], actionPlan: [], score: 100, grade: "A" }),
    );
    const allOutput = logSpy.mock.calls.flat().join("\n");
    expect(allOutput).not.toContain("FINDINGS");
    expect(allOutput).not.toContain("TOP ISSUES");
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
