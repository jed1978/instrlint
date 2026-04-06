import { describe, it, expect, beforeAll } from "vitest";
import { reportSarif } from "../../src/reporters/sarif.js";
import { ensureInitialized } from "../../src/detectors/token-estimator.js";
import { initLocale } from "../../src/i18n/index.js";
import type { BudgetSummary, Finding, HealthReport } from "../../src/types.js";

beforeAll(async () => {
  await ensureInitialized();
  initLocale("en");
});

function makeBudget(): BudgetSummary {
  return {
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
}

function makeReport(findings: Finding[] = []): HealthReport {
  return {
    project: "test-project",
    tool: "claude-code",
    score: 84,
    grade: "B",
    locale: "en",
    tokenMethod: "estimated",
    findings,
    budget: makeBudget(),
    actionPlan: [],
  };
}

const sampleFindings: Finding[] = [
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
    suggestion: "Contradicting rules at lines 47 and 109",
    autoFixable: false,
  },
  {
    severity: "warning",
    category: "dead-rule",
    file: "CLAUDE.md",
    line: 16,
    messageKey: "deadRule.configOverlap",
    messageParams: { rule: "strict mode", config: "tsconfig.json" },
    suggestion: "Rule already enforced by tsconfig.json",
    autoFixable: true,
  },
];

describe("reportSarif", () => {
  it("produces valid JSON", () => {
    const output = reportSarif(makeReport());
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it("has correct SARIF $schema", () => {
    const parsed = JSON.parse(reportSarif(makeReport()));
    expect(parsed.$schema).toContain("sarif-schema-2.1.0.json");
  });

  it("has version 2.1.0", () => {
    const parsed = JSON.parse(reportSarif(makeReport()));
    expect(parsed.version).toBe("2.1.0");
  });

  it("has exactly one run", () => {
    const parsed = JSON.parse(reportSarif(makeReport()));
    expect(parsed.runs).toHaveLength(1);
  });

  it("driver name is instrlint", () => {
    const parsed = JSON.parse(reportSarif(makeReport()));
    expect(parsed.runs[0].tool.driver.name).toBe("instrlint");
  });

  it("produces zero results for empty findings", () => {
    const parsed = JSON.parse(reportSarif(makeReport([])));
    expect(parsed.runs[0].results).toHaveLength(0);
    expect(parsed.runs[0].tool.driver.rules).toHaveLength(0);
  });

  it("maps critical finding to level=error", () => {
    const parsed = JSON.parse(reportSarif(makeReport(sampleFindings)));
    const critical = parsed.runs[0].results.find(
      (r: { level: string }) => r.level === "error",
    );
    expect(critical).toBeDefined();
  });

  it("maps warning finding to level=warning", () => {
    const parsed = JSON.parse(reportSarif(makeReport(sampleFindings)));
    const warning = parsed.runs[0].results.find(
      (r: { level: string }) => r.level === "warning",
    );
    expect(warning).toBeDefined();
  });

  it("includes file path in locations", () => {
    const parsed = JSON.parse(reportSarif(makeReport(sampleFindings)));
    const result = parsed.runs[0].results[0];
    expect(result.locations[0].physicalLocation.artifactLocation.uri).toBe(
      "CLAUDE.md",
    );
  });

  it("includes line number in region when finding has line", () => {
    const parsed = JSON.parse(reportSarif(makeReport(sampleFindings)));
    const result = parsed.runs[0].results[0];
    expect(result.locations[0].physicalLocation.region?.startLine).toBe(47);
  });

  it("deduplicates rules with same ruleId", () => {
    const findings: Finding[] = [
      { ...sampleFindings[0]!, line: 10 },
      { ...sampleFindings[0]!, line: 20 },
    ];
    const parsed = JSON.parse(reportSarif(makeReport(findings)));
    expect(parsed.runs[0].tool.driver.rules).toHaveLength(1);
    expect(parsed.runs[0].results).toHaveLength(2);
  });
});
