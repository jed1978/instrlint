import { describe, it, expect } from "vitest";
import {
  buildCandidates,
  hashFinding,
} from "../../src/verifiers/candidates.js";
import type { Finding, ParsedInstructions } from "../../src/types.js";

function makeInstructions(
  rootLines: Array<{ lineNumber: number; text: string }>,
): ParsedInstructions {
  return {
    tool: "claude-code",
    rootFile: {
      path: "CLAUDE.md",
      lines: rootLines.map((l) => ({
        ...l,
        type: "rule" as const,
        keywords: [],
        referencedPaths: [],
      })),
      lineCount: rootLines.length,
      tokenCount: 100,
      tokenMethod: "estimated" as const,
    },
    rules: [],
    skills: [],
    subFiles: [],
    mcpServers: [],
  };
}

const contradictionFinding: Finding = {
  severity: "critical",
  category: "contradiction",
  file: "CLAUDE.md",
  line: 20,
  messageKey: "structure.contradiction",
  messageParams: {
    snippet: "Use exceptions...",
    lineA: "10",
    lineB: "20",
    fileA: "CLAUDE.md",
  },
  suggestion: "",
  autoFixable: false,
};

const parsed = makeInstructions([
  { lineNumber: 10, text: "- Use exceptions for error handling." },
  { lineNumber: 20, text: "- Never throw exceptions, use Result<T> instead." },
]);

describe("buildCandidates", () => {
  it("includes contradiction findings", () => {
    const file = buildCandidates(
      [contradictionFinding],
      parsed,
      "/project",
      "en",
    );
    expect(file.version).toBe(1);
    expect(file.candidates).toHaveLength(1);
    const c = file.candidates[0]!;
    expect(c.category).toBe("contradiction");
    expect(c.context.type).toBe("contradiction");
  });

  it("populates ruleA and ruleB text from parsed instructions", () => {
    const file = buildCandidates(
      [contradictionFinding],
      parsed,
      "/project",
      "en",
    );
    const ctx = file.candidates[0]!.context;
    if (ctx.type !== "contradiction") throw new Error("wrong type");
    expect(ctx.ruleA.text).toBe("- Use exceptions for error handling.");
    expect(ctx.ruleB.text).toBe(
      "- Never throw exceptions, use Result<T> instead.",
    );
  });

  it("includes a non-empty question", () => {
    const file = buildCandidates(
      [contradictionFinding],
      parsed,
      "/project",
      "en",
    );
    expect(file.candidates[0]!.question.length).toBeGreaterThan(10);
  });

  it("uses zh-TW question when locale is zh-TW", () => {
    const en = buildCandidates(
      [contradictionFinding],
      parsed,
      "/project",
      "en",
    );
    const zhTW = buildCandidates(
      [contradictionFinding],
      parsed,
      "/project",
      "zh-TW",
    );
    expect(zhTW.candidates[0]!.question).not.toBe(en.candidates[0]!.question);
  });

  it("skips stale-ref findings (not verifiable)", () => {
    const staleRef: Finding = {
      severity: "warning",
      category: "stale-ref",
      file: "CLAUDE.md",
      line: 5,
      messageKey: "stale.ref",
      suggestion: "",
      autoFixable: true,
    };
    const file = buildCandidates([staleRef], parsed, "/project", "en");
    expect(file.candidates).toHaveLength(0);
  });

  it("assigns a stable 12-char hex id", () => {
    const file = buildCandidates(
      [contradictionFinding],
      parsed,
      "/project",
      "en",
    );
    expect(file.candidates[0]!.id).toMatch(/^[0-9a-f]{12}$/);
  });

  it("same finding always gets same id (stable hash)", () => {
    const id1 = hashFinding(contradictionFinding);
    const id2 = hashFinding(contradictionFinding);
    expect(id1).toBe(id2);
  });

  it("context ruleA and ruleB files are project-relative paths", () => {
    const file = buildCandidates(
      [contradictionFinding],
      parsed,
      "/project",
      "en",
    );
    const ctx = file.candidates[0]!.context;
    if (ctx.type !== "contradiction") throw new Error("wrong type");
    expect(ctx.ruleA.file).toBe("CLAUDE.md");
    expect(ctx.ruleB.file).toBe("CLAUDE.md");
    expect(ctx.ruleA.file).not.toContain("/project");
  });
});
