import { describe, it, expect, beforeAll } from "vitest";
import { join } from "path";
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

describe("detectDuplicates: pair deduplication", () => {
  it("each ordered pair is reported at most once, never both (A,B) and (B,A)", () => {
    const text =
      "Unit tests must be written for all public functions. Tests must cover success path.";
    const instructions = makeInstructions([
      [text, 10],
      [text, 20],
    ]);
    const findings = detectDuplicates(instructions);
    // Exactly one finding: (10→20), never the reverse (20→10) as well
    expect(findings).toHaveLength(1);
    expect(findings[0]!.line).toBe(20);
  });

  it("three mutually-similar lines produce exactly 3 pair findings", () => {
    const base =
      "Unit tests must be written for all public functions. Tests must cover success path.";
    const similar1 =
      "Unit tests must be written for all public functions. Tests must cover each success path.";
    const similar2 =
      "Unit tests must be written for all public functions. Tests must cover every success path.";
    const instructions = makeInstructions([
      [base, 1],
      [similar1, 2],
      [similar2, 3],
    ]);
    const findings = detectDuplicates(instructions);
    // 3 unique ordered pairs: (1,2), (1,3), (2,3) — each reported once = 3 findings
    expect(findings).toHaveLength(3);
  });
});

// ─── Chinese duplicate tests ──────────────────────────────────────────────────

describe("detectDuplicates: Chinese rules", () => {
  it("detects exact Chinese duplicate", () => {
    const text = "永遠使用 TypeScript 嚴格模式確保型別安全";
    const instructions = makeInstructions([
      [text, 10],
      [text, 20],
    ]);
    const findings = detectDuplicates(instructions);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe("warning");
    expect(findings[0]!.autoFixable).toBe(true);
  });

  it("detects near-duplicate Chinese rules with different phrasing", () => {
    // Long shared suffix ensures jaccard > 0.7 despite different leading bigrams
    const a = "永遠使用 TypeScript 嚴格模式確保型別安全以避免執行期錯誤";
    const b = "應該使用 TypeScript 嚴格模式確保型別安全以避免執行期錯誤";
    const instructions = makeInstructions([
      [a, 10],
      [b, 20],
    ]);
    const findings = detectDuplicates(instructions);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it("does not flag unrelated Chinese rules as duplicates", () => {
    const instructions = makeInstructions([
      ["永遠使用 TypeScript 嚴格模式確保型別安全", 10],
      ["禁止在 production 環境輸出敏感資訊日誌", 20],
    ]);
    expect(detectDuplicates(instructions)).toHaveLength(0);
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
