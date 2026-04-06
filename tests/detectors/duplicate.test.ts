import { describe, it, expect, beforeAll } from "vitest";
import { join } from "path";
import {
  tokenizeWords,
  removeStopWords,
  jaccardSimilarity,
} from "../../src/utils/text.js";
import { detectDuplicates } from "../../src/detectors/duplicate.js";
import { ensureInitialized } from "../../src/detectors/token-estimator.js";
import { loadClaudeCodeProject } from "../../src/adapters/claude-code.js";
import type { ParsedInstructions, ParsedLine } from "../../src/types.js";

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeLine(text: string, lineNumber = 1): ParsedLine {
  return { lineNumber, text, type: "rule", keywords: [], referencedPaths: [] };
}

function makeInstructions(
  rulePairs: Array<[string, number]>,
): ParsedInstructions {
  return {
    tool: "claude-code",
    rootFile: {
      path: "CLAUDE.md",
      lines: rulePairs.map(([text, ln]) => makeLine(text, ln)),
      lineCount: rulePairs.length,
      tokenCount: 100,
      tokenMethod: "estimated",
    },
    rules: [],
    skills: [],
    subFiles: [],
    mcpServers: [],
  };
}

// ─── Text utility tests ───────────────────────────────────────────────────────

describe("tokenizeWords", () => {
  it("lowercases and splits on non-alphanumeric", () => {
    expect(tokenizeWords("Hello, World!")).toEqual(["hello", "world"]);
  });

  it("filters single-char tokens", () => {
    const words = tokenizeWords("use a b cd efgh");
    expect(words).not.toContain("a");
    expect(words).not.toContain("b");
    expect(words).toContain("cd");
    expect(words).toContain("efgh");
  });

  it("handles empty string", () => {
    expect(tokenizeWords("")).toEqual([]);
  });
});

describe("removeStopWords", () => {
  it("removes known stop words", () => {
    const words = ["use", "the", "result", "for", "testing", "and", "coverage"];
    expect(removeStopWords(words)).toEqual([
      "use",
      "result",
      "testing",
      "coverage",
    ]);
  });

  it("preserves non-stop words", () => {
    const words = ["typescript", "strict", "mode"];
    expect(removeStopWords(words)).toEqual(["typescript", "strict", "mode"]);
  });
});

describe("jaccardSimilarity", () => {
  it("returns 1.0 for identical sets", () => {
    expect(jaccardSimilarity(["a", "b", "c"], ["a", "b", "c"])).toBe(1);
  });

  it("returns 0.0 for disjoint sets", () => {
    expect(jaccardSimilarity(["a", "b"], ["c", "d"])).toBe(0);
  });

  it("returns correct value for overlapping sets", () => {
    // intersection={b,c}, union={a,b,c,d} → 2/4 = 0.5
    expect(jaccardSimilarity(["a", "b", "c"], ["b", "c", "d"])).toBeCloseTo(
      0.5,
    );
  });

  it("returns 0 for two empty sets", () => {
    expect(jaccardSimilarity([], [])).toBe(0);
  });
});

// ─── detectDuplicates tests ───────────────────────────────────────────────────

describe("detectDuplicates: identical lines", () => {
  it("reports exact duplicate as warning with autoFixable:true", () => {
    const text =
      "Use conventional commit format for all commits. Format: type description.";
    const instructions = makeInstructions([
      [text, 37],
      [text, 130],
    ]);
    const findings = detectDuplicates(instructions);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe("warning");
    expect(findings[0]!.autoFixable).toBe(true);
    expect(findings[0]!.category).toBe("duplicate");
    expect(findings[0]!.line).toBe(130);
  });
});

describe("detectDuplicates: similar lines", () => {
  it("reports near-duplicate as info with autoFixable:false", () => {
    const a =
      "Unit tests must be written for all public functions. Tests must cover at least one success path and one failure path.";
    const b =
      "Unit tests must be written for all public functions. Each test must cover at least one success path and one error path.";
    const instructions = makeInstructions([
      [a, 42],
      [b, 135],
    ]);
    const findings = detectDuplicates(instructions);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe("info");
    expect(findings[0]!.autoFixable).toBe(false);
    expect(findings[0]!.category).toBe("duplicate");
  });
});

describe("detectDuplicates: different lines", () => {
  it("produces no finding for unrelated rules", () => {
    const instructions = makeInstructions([
      ["Always use TypeScript strict mode.", 1],
      ["Deploy to staging before production.", 2],
    ]);
    const findings = detectDuplicates(instructions);
    expect(findings).toHaveLength(0);
  });
});

describe("detectDuplicates: single line", () => {
  it("produces no finding with only one rule line", () => {
    const instructions = makeInstructions([
      ["Always use TypeScript strict mode.", 1],
    ]);
    const findings = detectDuplicates(instructions);
    expect(findings).toHaveLength(0);
  });
});

describe("detectDuplicates: short lines skipped", () => {
  it("skips lines with fewer than 4 meaningful words", () => {
    // After stop word removal, "Use the result" → ["use", "result"] = 2 words < 4
    const instructions = makeInstructions([
      ["Use the result.", 1],
      ["Use the result.", 2],
    ]);
    const findings = detectDuplicates(instructions);
    expect(findings).toHaveLength(0);
  });
});

describe("detectDuplicates: no double-reporting", () => {
  it("does not report (A,B) and (B,A)", () => {
    const text =
      "Use conventional commit format for all commits. Format: type description scope.";
    const instructions = makeInstructions([
      [text, 10],
      [text, 20],
    ]);
    const findings = detectDuplicates(instructions);
    expect(findings).toHaveLength(1);
  });
});

// ─── Integration tests ────────────────────────────────────────────────────────

describe("detectDuplicates integration: sample-project", () => {
  let instructions: ReturnType<typeof loadClaudeCodeProject>;

  beforeAll(() => {
    instructions = loadClaudeCodeProject(SAMPLE_PROJECT);
  });

  it("finds exactly 2 duplicate findings", () => {
    const findings = detectDuplicates(instructions);
    expect(findings.filter((f) => f.category === "duplicate")).toHaveLength(2);
  });

  it("one exact duplicate (warning) and one near-duplicate (info)", () => {
    const findings = detectDuplicates(instructions);
    expect(findings.filter((f) => f.severity === "warning")).toHaveLength(1);
    expect(findings.filter((f) => f.severity === "info")).toHaveLength(1);
  });
});

describe("detectDuplicates integration: clean-project", () => {
  let instructions: ReturnType<typeof loadClaudeCodeProject>;

  beforeAll(() => {
    instructions = loadClaudeCodeProject(CLEAN_PROJECT);
  });

  it("finds 0 duplicates", () => {
    const findings = detectDuplicates(instructions);
    expect(findings).toHaveLength(0);
  });
});
