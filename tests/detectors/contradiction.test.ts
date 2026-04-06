import { describe, it, expect, beforeAll } from "vitest";
import { join } from "path";
import { detectContradictions } from "../../src/detectors/contradiction.js";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// Texts that share ≥ 3 domain words (exceptions, throw, error, handling) after polarity-stop removal
const EXCEPTION_RULE =
  "Use exceptions for error handling. Throw errors with descriptive messages at the point of failure.";
const RESULT_RULE =
  "Use Result<T> pattern for error handling, never throw exceptions. Functions that fail must return Result<T, E>.";

// ─── Unit tests ───────────────────────────────────────────────────────────────

describe("detectContradictions: no contradiction when polarity matches", () => {
  it("two rules with same polarity on shared words → no finding", () => {
    const instructions = makeInstructions([
      [
        "Use exceptions for error handling. Throw errors at the point of failure.",
        1,
      ],
      [
        "Always throw exceptions with descriptive error messages for failures.",
        2,
      ],
    ]);
    const findings = detectContradictions(instructions);
    expect(findings).toHaveLength(0);
  });
});

describe("detectContradictions: no contradiction when < 3 shared words", () => {
  it("lines share only 2 content words → no finding", () => {
    const instructions = makeInstructions([
      ["Never commit secrets to the repository.", 1],
      ["Always use TypeScript strict mode.", 2],
    ]);
    const findings = detectContradictions(instructions);
    expect(findings).toHaveLength(0);
  });
});

describe("detectContradictions: detects contradiction", () => {
  it("opposite polarity on shared words with ≥ 3 shared words → critical finding", () => {
    const instructions = makeInstructions([
      [EXCEPTION_RULE, 10],
      [RESULT_RULE, 50],
    ]);
    const findings = detectContradictions(instructions);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe("critical");
    expect(findings[0]!.category).toBe("contradiction");
    expect(findings[0]!.autoFixable).toBe(false);
    expect(findings[0]!.line).toBe(50);
  });

  it("reports the later line number", () => {
    const instructions = makeInstructions([
      [EXCEPTION_RULE, 10],
      [RESULT_RULE, 90],
    ]);
    const findings = detectContradictions(instructions);
    expect(findings[0]!.line).toBe(90);
  });
});

describe("detectContradictions: pair deduplication", () => {
  it("each contradicting pair is reported exactly once", () => {
    const instructions = makeInstructions([
      [EXCEPTION_RULE, 10],
      [RESULT_RULE, 20],
    ]);
    const findings = detectContradictions(instructions);
    expect(findings).toHaveLength(1);
  });
});

describe("detectContradictions: single rule line", () => {
  it("produces no finding with only one rule line", () => {
    const instructions = makeInstructions([
      ["Never throw exceptions. Always use Result<T>.", 1],
    ]);
    const findings = detectContradictions(instructions);
    expect(findings).toHaveLength(0);
  });
});

// ─── Integration tests ────────────────────────────────────────────────────────

describe("detectContradictions integration: sample-project", () => {
  let instructions: ReturnType<typeof loadClaudeCodeProject>;

  beforeAll(() => {
    instructions = loadClaudeCodeProject(SAMPLE_PROJECT);
  });

  it("finds exactly 1 contradiction", () => {
    const findings = detectContradictions(instructions);
    expect(findings.filter((f) => f.category === "contradiction")).toHaveLength(
      1,
    );
  });

  it("the contradiction is critical severity and not autoFixable", () => {
    const findings = detectContradictions(instructions);
    expect(findings[0]!.severity).toBe("critical");
    expect(findings[0]!.autoFixable).toBe(false);
  });
});

describe("detectContradictions integration: clean-project", () => {
  let instructions: ReturnType<typeof loadClaudeCodeProject>;

  beforeAll(() => {
    instructions = loadClaudeCodeProject(CLEAN_PROJECT);
  });

  it("finds 0 contradictions", () => {
    const findings = detectContradictions(instructions);
    expect(findings).toHaveLength(0);
  });
});
