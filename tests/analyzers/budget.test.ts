import { describe, it, expect, beforeAll } from "vitest";
import { join } from "path";
import { loadClaudeCodeProject } from "../../src/adapters/claude-code.js";
import { ensureInitialized } from "../../src/detectors/token-estimator.js";
import { analyzeBudget } from "../../src/analyzers/budget.js";
import type { ParsedInstructions } from "../../src/types.js";

const SAMPLE_PROJECT = join(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../fixtures/sample-project",
);

const CLEAN_PROJECT = join(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../fixtures/clean-project",
);

beforeAll(async () => {
  await ensureInitialized();
});

describe("analyzeBudget — sample-project", () => {
  let instructions: ParsedInstructions;

  beforeAll(() => {
    instructions = loadClaudeCodeProject(SAMPLE_PROJECT);
  });

  it("produces findings because root file is > 200 lines", () => {
    const { findings } = analyzeBudget(instructions);
    const budgetFindings = findings.filter((f) => f.category === "budget");
    expect(budgetFindings.length).toBeGreaterThan(0);
  });

  it("root file line warning or critical is present", () => {
    const { findings } = analyzeBudget(instructions);
    const lineFindings = findings.filter(
      (f) =>
        f.category === "budget" &&
        (f.messageKey === "budget.rootFileWarning" ||
          f.messageKey === "budget.rootFileCritical"),
    );
    expect(lineFindings.length).toBeGreaterThan(0);
  });

  it("summary.systemPromptTokens is 12000", () => {
    const { summary } = analyzeBudget(instructions);
    expect(summary.systemPromptTokens).toBe(12_000);
  });

  it("summary.rootFileTokens is > 0", () => {
    const { summary } = analyzeBudget(instructions);
    expect(summary.rootFileTokens).toBeGreaterThan(0);
  });

  it("summary.rootFileLines matches actual line count", () => {
    const { summary } = analyzeBudget(instructions);
    expect(summary.rootFileLines).toBe(instructions.rootFile.lineCount);
  });

  it("summary.totalBaseline equals sum of parts", () => {
    const { summary } = analyzeBudget(instructions);
    const expected =
      summary.systemPromptTokens +
      summary.rootFileTokens +
      summary.rulesTokens +
      summary.skillsTokens +
      summary.subFilesTokens +
      summary.mcpTokens;
    expect(summary.totalBaseline).toBe(expected);
  });

  it("summary.availableTokens = 200K - totalBaseline", () => {
    const { summary } = analyzeBudget(instructions);
    expect(summary.availableTokens).toBe(200_000 - summary.totalBaseline);
  });

  it("summary.mcpTokens > 0 (sample-project has 2 MCP servers)", () => {
    const { summary } = analyzeBudget(instructions);
    expect(summary.mcpTokens).toBeGreaterThan(0);
  });

  it("fileBreakdown contains root file entry", () => {
    const { summary } = analyzeBudget(instructions);
    expect(
      summary.fileBreakdown.some((e) => e.path.includes("CLAUDE.md")),
    ).toBe(true);
  });

  it("tokenMethod is set", () => {
    const { summary } = analyzeBudget(instructions);
    expect(["measured", "estimated"]).toContain(summary.tokenMethod);
  });
});

describe("analyzeBudget — clean-project", () => {
  let instructions: ParsedInstructions;

  beforeAll(() => {
    instructions = loadClaudeCodeProject(CLEAN_PROJECT);
  });

  it("produces no budget findings for a clean small project", () => {
    const { findings } = analyzeBudget(instructions);
    const budgetFindings = findings.filter((f) => f.category === "budget");
    expect(budgetFindings).toHaveLength(0);
  });

  it("rootFileTokens is in a reasonable range", () => {
    const { summary } = analyzeBudget(instructions);
    // clean-project CLAUDE.md < 50 lines → should be well under 2K tokens
    expect(summary.rootFileTokens).toBeGreaterThan(0);
    expect(summary.rootFileTokens).toBeLessThan(2_000);
  });

  it("mcpTokens is 0 (no settings.json)", () => {
    const { summary } = analyzeBudget(instructions);
    expect(summary.mcpTokens).toBe(0);
  });
});

describe("analyzeBudget — MCP server findings", () => {
  it("info finding when MCP server > 10K tokens", () => {
    const mockInstructions: ParsedInstructions = {
      tool: "claude-code",
      rootFile: {
        path: "CLAUDE.md",
        lines: [],
        lineCount: 10,
        tokenCount: 500,
        tokenMethod: "measured",
      },
      rules: [],
      skills: [],
      subFiles: [],
      mcpServers: [
        { name: "big-server", toolCount: 30, estimatedTokens: 12_000 },
      ],
    };

    const { findings } = analyzeBudget(mockInstructions);
    const mcpFinding = findings.find(
      (f) => f.messageKey === "budget.mcpLargeServer",
    );
    expect(mcpFinding).toBeDefined();
    expect(mcpFinding?.severity).toBe("info");
    expect(mcpFinding?.messageParams?.["name"]).toBe("big-server");
  });

  it("no MCP finding when server <= 10K tokens", () => {
    const mockInstructions: ParsedInstructions = {
      tool: "claude-code",
      rootFile: {
        path: "CLAUDE.md",
        lines: [],
        lineCount: 10,
        tokenCount: 500,
        tokenMethod: "measured",
      },
      rules: [],
      skills: [],
      subFiles: [],
      mcpServers: [
        { name: "small-server", toolCount: 5, estimatedTokens: 2_000 },
      ],
    };

    const { findings } = analyzeBudget(mockInstructions);
    const mcpFinding = findings.find(
      (f) => f.messageKey === "budget.mcpLargeServer",
    );
    expect(mcpFinding).toBeUndefined();
  });
});

describe("analyzeBudget — baseline threshold", () => {
  it("warning when totalBaseline > 50K (25% of 200K)", () => {
    const bigRootFile = {
      path: "CLAUDE.md",
      lines: Array(201).fill({
        lineNumber: 1,
        text: "x",
        type: "rule" as const,
        keywords: [],
        referencedPaths: [],
      }),
      lineCount: 201,
      tokenCount: 40_000,
      tokenMethod: "estimated" as const,
    };

    const mockInstructions: ParsedInstructions = {
      tool: "claude-code",
      rootFile: bigRootFile,
      rules: [],
      skills: [],
      subFiles: [],
      mcpServers: [],
    };

    const { findings } = analyzeBudget(mockInstructions);
    const baselineFinding = findings.find(
      (f) => f.messageKey === "budget.baselineHigh",
    );
    expect(baselineFinding).toBeDefined();
    expect(baselineFinding?.severity).toBe("warning");
  });
});
