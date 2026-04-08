import { describe, it, expect, beforeAll } from "vitest";
import { join } from "path";
import { analyzeStructure } from "../../src/analyzers/structure.js";
import { classifyScope } from "../../src/detectors/scope-classifier.js";
import { ensureInitialized } from "../../src/detectors/token-estimator.js";
import { loadClaudeCodeProject } from "../../src/adapters/claude-code.js";

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

// ─── Integration: sample-project ─────────────────────────────────────────────

describe("analyzeStructure integration: sample-project", () => {
  let instructions: ReturnType<typeof loadClaudeCodeProject>;

  beforeAll(() => {
    instructions = loadClaudeCodeProject(SAMPLE_PROJECT);
  });

  it("finds at least 1 contradiction", () => {
    const { findings } = analyzeStructure(instructions, SAMPLE_PROJECT);
    expect(
      findings.filter((f) => f.category === "contradiction").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("finds at least 2 stale references", () => {
    const { findings } = analyzeStructure(instructions, SAMPLE_PROJECT);
    expect(
      findings.filter((f) => f.category === "stale-ref").length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("finds at least 5 scope suggestions", () => {
    const { findings } = analyzeStructure(instructions, SAMPLE_PROJECT);
    expect(
      findings.filter((f) => f.category === "structure").length,
    ).toBeGreaterThanOrEqual(5);
  });

  it("contradictions are critical severity", () => {
    const { findings } = analyzeStructure(instructions, SAMPLE_PROJECT);
    expect(
      findings
        .filter((f) => f.category === "contradiction")
        .every((f) => f.severity === "critical"),
    ).toBe(true);
  });

  it("stale refs are warning severity and autoFixable", () => {
    const { findings } = analyzeStructure(instructions, SAMPLE_PROJECT);
    expect(
      findings
        .filter((f) => f.category === "stale-ref")
        .every((f) => f.severity === "warning" && f.autoFixable === true),
    ).toBe(true);
  });

  it("scope suggestions are info severity and not autoFixable", () => {
    const { findings } = analyzeStructure(instructions, SAMPLE_PROJECT);
    expect(
      findings
        .filter((f) => f.category === "structure")
        .every((f) => f.severity === "info" && f.autoFixable === false),
    ).toBe(true);
  });
});

// ─── Integration: clean-project ───────────────────────────────────────────────

describe("analyzeStructure integration: clean-project", () => {
  let instructions: ReturnType<typeof loadClaudeCodeProject>;

  beforeAll(() => {
    instructions = loadClaudeCodeProject(CLEAN_PROJECT);
  });

  it("finds 0 findings", () => {
    const { findings } = analyzeStructure(instructions, CLEAN_PROJECT);
    expect(findings).toHaveLength(0);
  });
});

// ─── Scope classifier unit tests ──────────────────────────────────────────────

describe("classifyScope: hook pattern", () => {
  it("detects hook suggestion for 'never commit' rule", () => {
    const instructions = {
      tool: "claude-code" as const,
      rootFile: {
        path: "CLAUDE.md",
        lines: [
          {
            lineNumber: 1,
            text: "Never commit API keys or secrets to the repository.",
            type: "rule" as const,
            keywords: [],
            referencedPaths: [],
          },
        ],
        lineCount: 1,
        tokenCount: 10,
        tokenMethod: "estimated" as const,
      },
      rules: [],
      skills: [],
      subFiles: [],
      mcpServers: [],
    };
    const findings = classifyScope(instructions);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.messageKey).toBe("structure.scopeHook");
    expect(findings[0]!.severity).toBe("info");
  });
});

describe("classifyScope: path-scoped pattern", () => {
  it("detects path-scoped suggestion for rule referencing src/", () => {
    const instructions = {
      tool: "claude-code" as const,
      rootFile: {
        path: "CLAUDE.md",
        lines: [
          {
            lineNumber: 5,
            text: "All UI components in src/components/ must meet WCAG 2.1 AA standards.",
            type: "rule" as const,
            keywords: [],
            referencedPaths: ["src/components/"],
          },
        ],
        lineCount: 1,
        tokenCount: 10,
        tokenMethod: "estimated" as const,
      },
      rules: [],
      skills: [],
      subFiles: [],
      mcpServers: [],
    };
    const findings = classifyScope(instructions);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.messageKey).toBe("structure.scopePathScoped");
  });

  it("does not flag heading lines", () => {
    const instructions = {
      tool: "claude-code" as const,
      rootFile: {
        path: "CLAUDE.md",
        lines: [
          {
            lineNumber: 1,
            text: "## src/components/ Guidelines",
            type: "heading" as const,
            keywords: [],
            referencedPaths: ["src/components/"],
          },
        ],
        lineCount: 1,
        tokenCount: 10,
        tokenMethod: "estimated" as const,
      },
      rules: [],
      skills: [],
      subFiles: [],
      mcpServers: [],
    };
    const findings = classifyScope(instructions);
    expect(findings).toHaveLength(0);
  });

  it("hook pattern takes priority over path-scoped pattern", () => {
    // A rule that matches both patterns should only emit one finding (hook wins)
    const instructions = {
      tool: "claude-code" as const,
      rootFile: {
        path: "CLAUDE.md",
        lines: [
          {
            lineNumber: 1,
            text: "Never push broken builds to src/main branch.",
            type: "rule" as const,
            keywords: [],
            referencedPaths: ["src/main"],
          },
        ],
        lineCount: 1,
        tokenCount: 10,
        tokenMethod: "estimated" as const,
      },
      rules: [],
      skills: [],
      subFiles: [],
      mcpServers: [],
    };
    const findings = classifyScope(instructions);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.messageKey).toBe("structure.scopeHook");
  });

  it("does not flag architectural decisions where 'never' and 'run' are far apart", () => {
    // Regression: CLAUDE.md line 142 was incorrectly flagged because 'run' appeared
    // many words after 'never' in an architectural explanation sentence.
    const instructions = {
      tool: "claude-code" as const,
      rootFile: {
        path: "CLAUDE.md",
        lines: [
          {
            lineNumber: 142,
            text: "LLM verification is host-orchestrated, never in-process. instrlint never calls an LLM API directly. When users want LLM-assisted verification, they run instrlint --emit-candidates.",
            type: "rule" as const,
            keywords: [],
            referencedPaths: [],
          },
        ],
        lineCount: 1,
        tokenCount: 30,
        tokenMethod: "estimated" as const,
      },
      rules: [],
      skills: [],
      subFiles: [],
      mcpServers: [],
    };
    const findings = classifyScope(instructions);
    expect(findings).toHaveLength(0);
  });
});
