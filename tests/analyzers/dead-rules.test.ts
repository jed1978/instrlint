import { describe, it, expect, beforeAll } from "vitest";
import { join } from "path";
import { analyzeDeadRules } from "../../src/analyzers/dead-rules.js";
import { loadClaudeCodeProject } from "../../src/adapters/claude-code.js";
import { ensureInitialized } from "../../src/detectors/token-estimator.js";

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

// ─── sample-project ───────────────────────────────────────────────────────────

describe("analyzeDeadRules — sample-project", () => {
  let result: ReturnType<typeof analyzeDeadRules>;

  beforeAll(() => {
    const instructions = loadClaudeCodeProject(SAMPLE_PROJECT);
    result = analyzeDeadRules(instructions, SAMPLE_PROJECT);
  });

  it("returns 7 total findings (5 dead-rule + 2 duplicate)", () => {
    expect(result.findings).toHaveLength(7);
  });

  it("has exactly 5 dead-rule findings", () => {
    expect(result.findings.filter((f) => f.category === "dead-rule")).toHaveLength(5);
  });

  it("has exactly 2 duplicate findings", () => {
    expect(result.findings.filter((f) => f.category === "duplicate")).toHaveLength(2);
  });

  it("all dead-rule findings have severity:warning", () => {
    const overlapFindings = result.findings.filter((f) => f.category === "dead-rule");
    expect(overlapFindings.every((f) => f.severity === "warning")).toBe(true);
  });

  it("all dead-rule findings have autoFixable:true", () => {
    const overlapFindings = result.findings.filter((f) => f.category === "dead-rule");
    expect(overlapFindings.every((f) => f.autoFixable === true)).toBe(true);
  });

  it("exact duplicate finding has severity:warning and autoFixable:true", () => {
    const exact = result.findings.find(
      (f) => f.category === "duplicate" && f.severity === "warning",
    );
    expect(exact).toBeDefined();
    expect(exact!.autoFixable).toBe(true);
  });

  it("near-duplicate finding has severity:info and autoFixable:false", () => {
    const near = result.findings.find(
      (f) => f.category === "duplicate" && f.severity === "info",
    );
    expect(near).toBeDefined();
    expect(near!.autoFixable).toBe(false);
  });

  it("all findings have a non-empty suggestion", () => {
    expect(result.findings.every((f) => f.suggestion.length > 0)).toBe(true);
  });

  it("all findings have a messageKey", () => {
    expect(result.findings.every((f) => f.messageKey.length > 0)).toBe(true);
  });
});

// ─── clean-project ────────────────────────────────────────────────────────────

describe("analyzeDeadRules — clean-project", () => {
  let result: ReturnType<typeof analyzeDeadRules>;

  beforeAll(() => {
    const instructions = loadClaudeCodeProject(CLEAN_PROJECT);
    result = analyzeDeadRules(instructions, CLEAN_PROJECT);
  });

  it("returns 0 findings", () => {
    expect(result.findings).toHaveLength(0);
  });
});
