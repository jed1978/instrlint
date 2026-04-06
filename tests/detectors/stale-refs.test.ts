import { describe, it, expect, beforeAll } from "vitest";
import { join } from "path";
import { detectStaleRefs } from "../../src/detectors/stale-refs.js";
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

function makeLine(
  text: string,
  referencedPaths: string[],
  lineNumber = 1,
): ParsedLine {
  return {
    lineNumber,
    text,
    type: "rule",
    keywords: [],
    referencedPaths,
  };
}

function makeInstructions(
  lines: ParsedLine[],
): ParsedInstructions {
  return {
    tool: "claude-code",
    rootFile: {
      path: "CLAUDE.md",
      lines,
      lineCount: lines.length,
      tokenCount: 100,
      tokenMethod: "estimated",
    },
    rules: [],
    skills: [],
    subFiles: [],
    mcpServers: [],
  };
}

// ─── Unit tests ───────────────────────────────────────────────────────────────

describe("detectStaleRefs: no paths", () => {
  it("line with no referencedPaths → no finding", () => {
    const instructions = makeInstructions([
      makeLine("Always use TypeScript strict mode.", []),
    ]);
    const findings = detectStaleRefs(instructions, "/tmp/nonexistent");
    expect(findings).toHaveLength(0);
  });
});

describe("detectStaleRefs: directory refs skipped", () => {
  it("path ending with / is ignored", () => {
    const instructions = makeInstructions([
      makeLine("Rules for src/components/ apply here.", ["src/components/"]),
    ]);
    const findings = detectStaleRefs(instructions, "/tmp/nonexistent");
    expect(findings).toHaveLength(0);
  });
});

describe("detectStaleRefs: glob patterns skipped", () => {
  it("path containing * is ignored", () => {
    const instructions = makeInstructions([
      makeLine("See src/**/*.ts for examples.", ["src/**/*.ts"]),
    ]);
    const findings = detectStaleRefs(instructions, "/tmp/nonexistent");
    expect(findings).toHaveLength(0);
  });
});

describe("detectStaleRefs: existing path", () => {
  it("path that exists → no finding", () => {
    const instructions = makeInstructions([
      makeLine(
        "See src/components/Button.tsx for the canonical example.",
        ["src/components/Button.tsx"],
      ),
    ]);
    // sample-project has Button.tsx
    const findings = detectStaleRefs(instructions, SAMPLE_PROJECT);
    expect(findings).toHaveLength(0);
  });
});

describe("detectStaleRefs: missing path", () => {
  it("path that does not exist → warning finding", () => {
    const instructions = makeInstructions([
      makeLine(
        "See src/legacy/OldService.ts for the old pattern.",
        ["src/legacy/OldService.ts"],
        54,
      ),
    ]);
    const findings = detectStaleRefs(instructions, SAMPLE_PROJECT);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe("warning");
    expect(findings[0]!.category).toBe("stale-ref");
    expect(findings[0]!.autoFixable).toBe(true);
    expect(findings[0]!.line).toBe(54);
    expect(findings[0]!.messageParams?.["path"]).toBe("src/legacy/OldService.ts");
  });

  it("multiple paths on one line — only stale ones are reported", () => {
    const instructions = makeInstructions([
      makeLine("See both files.", [
        "src/components/Button.tsx", // exists
        "src/legacy/OldService.ts", // does not exist
      ]),
    ]);
    const findings = detectStaleRefs(instructions, SAMPLE_PROJECT);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.messageParams?.["path"]).toBe("src/legacy/OldService.ts");
  });
});

// ─── Integration tests ────────────────────────────────────────────────────────

describe("detectStaleRefs integration: sample-project", () => {
  let instructions: ReturnType<typeof loadClaudeCodeProject>;

  beforeAll(() => {
    instructions = loadClaudeCodeProject(SAMPLE_PROJECT);
  });

  it("finds exactly 2 stale references", () => {
    const findings = detectStaleRefs(instructions, SAMPLE_PROJECT);
    expect(findings.filter((f) => f.category === "stale-ref")).toHaveLength(2);
  });

  it("all stale-ref findings have severity:warning and autoFixable:true", () => {
    const findings = detectStaleRefs(instructions, SAMPLE_PROJECT);
    expect(
      findings.every((f) => f.severity === "warning" && f.autoFixable === true),
    ).toBe(true);
  });

  it("flags src/legacy/OldService.ts as stale", () => {
    const findings = detectStaleRefs(instructions, SAMPLE_PROJECT);
    expect(
      findings.some((f) => f.messageParams?.["path"] === "src/legacy/OldService.ts"),
    ).toBe(true);
  });

  it("flags src/components/index.ts as stale", () => {
    const findings = detectStaleRefs(instructions, SAMPLE_PROJECT);
    expect(
      findings.some((f) => f.messageParams?.["path"] === "src/components/index.ts"),
    ).toBe(true);
  });
});

describe("detectStaleRefs integration: clean-project", () => {
  let instructions: ReturnType<typeof loadClaudeCodeProject>;

  beforeAll(() => {
    instructions = loadClaudeCodeProject(CLEAN_PROJECT);
  });

  it("finds 0 stale refs", () => {
    const findings = detectStaleRefs(instructions, CLEAN_PROJECT);
    expect(findings).toHaveLength(0);
  });
});
