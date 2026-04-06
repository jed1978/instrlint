import { describe, it, expect } from "vitest";
import type {
  ToolType,
  TokenMethod,
  Locale,
  Severity,
  FindingCategory,
  ParsedLine,
  InstructionFile,
  RuleFile,
  SkillFile,
  McpServerConfig,
  ParsedInstructions,
  Finding,
  ActionItem,
  HealthReport,
} from "../src/types.js";

describe("types", () => {
  it("ParsedLine can be constructed", () => {
    const line: ParsedLine = {
      lineNumber: 1,
      text: "Always use TypeScript strict mode.",
      type: "rule",
      keywords: ["typescript", "strict"],
      referencedPaths: [],
    };
    expect(line.lineNumber).toBe(1);
    expect(line.type).toBe("rule");
  });

  it("InstructionFile can be constructed", () => {
    const file: InstructionFile = {
      path: "CLAUDE.md",
      lines: [],
      lineCount: 0,
      tokenCount: 0,
      tokenMethod: "measured",
    };
    expect(file.tokenMethod).toBe("measured");
  });

  it("RuleFile extends InstructionFile with optional path filters", () => {
    const rule: RuleFile = {
      path: ".claude/rules/typescript.md",
      lines: [],
      lineCount: 10,
      tokenCount: 42,
      tokenMethod: "measured",
      paths: ["src/**/*.ts"],
    };
    expect(rule.paths).toEqual(["src/**/*.ts"]);
    expect(rule.globs).toBeUndefined();
  });

  it("SkillFile extends InstructionFile with skillName", () => {
    const skill: SkillFile = {
      path: ".claude/skills/deploy/SKILL.md",
      lines: [],
      lineCount: 20,
      tokenCount: 100,
      tokenMethod: "measured",
      skillName: "deploy",
    };
    expect(skill.skillName).toBe("deploy");
  });

  it("McpServerConfig can be constructed", () => {
    const mcp: McpServerConfig = {
      name: "github",
      toolCount: 15,
      estimatedTokens: 6000,
    };
    expect(mcp.estimatedTokens).toBe(6000);
  });

  it("ParsedInstructions can be constructed", () => {
    const rootFile: InstructionFile = {
      path: "CLAUDE.md",
      lines: [],
      lineCount: 100,
      tokenCount: 1200,
      tokenMethod: "measured",
    };
    const instructions: ParsedInstructions = {
      tool: "claude-code",
      rootFile,
      rules: [],
      skills: [],
      subFiles: [],
      mcpServers: [],
    };
    expect(instructions.tool).toBe("claude-code");
  });

  it("Finding can be constructed with optional fields", () => {
    const finding: Finding = {
      severity: "warning",
      category: "dead-rule",
      file: "CLAUDE.md",
      line: 12,
      messageKey: "findings.deadRule.configOverlap",
      messageParams: { rule: "strict mode", config: "tsconfig.json" },
      suggestion: "Remove this rule — tsconfig.json already enforces it.",
      autoFixable: true,
    };
    expect(finding.severity).toBe("warning");
    expect(finding.autoFixable).toBe(true);
  });

  it("Finding line is optional", () => {
    const finding: Finding = {
      severity: "info",
      category: "structure",
      file: "CLAUDE.md",
      messageKey: "findings.structure.pathScoped",
      suggestion: "Extract component rules into a path-scoped rule file.",
      autoFixable: false,
    };
    expect(finding.line).toBeUndefined();
  });

  it("HealthReport can be constructed", () => {
    const report: HealthReport = {
      project: "sample-project",
      tool: "claude-code",
      score: 72,
      locale: "en",
      tokenMethod: "measured",
      findings: [],
      budget: {
        totalTokens: 4200,
        fileBreakdown: [],
        mcpTokens: 6000,
        availableTokens: 189800,
      },
      actionPlan: [],
    };
    expect(report.score).toBe(72);
    expect(report.tokenMethod).toBe("measured");
  });

  it("type aliases accept correct literal values", () => {
    const tool: ToolType = "claude-code";
    const method: TokenMethod = "estimated";
    const locale: Locale = "zh-TW";
    const severity: Severity = "critical";
    const category: FindingCategory = "contradiction";

    expect(tool).toBe("claude-code");
    expect(method).toBe("estimated");
    expect(locale).toBe("zh-TW");
    expect(severity).toBe("critical");
    expect(category).toBe("contradiction");
  });

  it("ActionItem has priority and estimatedSavings", () => {
    const action: ActionItem = {
      priority: 1,
      description: "Remove 5 dead rules enforced by tsconfig and prettier",
      category: "dead-rule",
      estimatedSavings: 120,
    };
    expect(action.priority).toBe(1);
    expect(action.estimatedSavings).toBe(120);
  });
});
