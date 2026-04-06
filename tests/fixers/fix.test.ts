import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, cpSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { removeDeadRules } from "../../src/fixers/remove-dead.js";
import { removeStaleRefs } from "../../src/fixers/remove-stale.js";
import { deduplicateRules } from "../../src/fixers/deduplicate.js";
import type { Finding } from "../../src/types.js";

const SAMPLE_PROJECT = join(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../fixtures/sample-project",
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "instrlint-fix-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(name: string, content: string): string {
  const path = join(tmpDir, name);
  writeFileSync(path, content, "utf8");
  return path;
}

function readFile(path: string): string {
  return readFileSync(path, "utf8");
}

function makeDeadRuleFinding(file: string, line: number): Finding {
  return {
    severity: "warning",
    category: "dead-rule",
    file,
    line,
    messageKey: "deadRule.configOverlap",
    suggestion: "Redundant rule",
    autoFixable: true,
  };
}

function makeStaleRefFinding(file: string, line: number): Finding {
  return {
    severity: "warning",
    category: "stale-ref",
    file,
    line,
    messageKey: "structure.staleRef",
    suggestion: "Stale reference",
    autoFixable: true,
  };
}

function makeDuplicateFinding(file: string, line: number): Finding {
  return {
    severity: "warning",
    category: "duplicate",
    file,
    line,
    messageKey: "deadRule.exactDuplicate",
    suggestion: "Duplicate rule",
    autoFixable: true,
  };
}

// ─── removeDeadRules ──────────────────────────────────────────────────────────

describe("removeDeadRules", () => {
  it("removes the flagged line", () => {
    const path = writeFile("CLAUDE.md", "line1\nline2\nline3\n");
    const count = removeDeadRules([makeDeadRuleFinding(path, 2)]);
    expect(count).toBe(1);
    expect(readFile(path)).toBe("line1\nline3\n");
  });

  it("removes multiple lines from the same file (bottom-up)", () => {
    const path = writeFile("CLAUDE.md", "keep\nremove-a\nkeep\nremove-b\n");
    removeDeadRules([
      makeDeadRuleFinding(path, 2),
      makeDeadRuleFinding(path, 4),
    ]);
    expect(readFile(path)).toBe("keep\nkeep\n");
  });

  it("removes lines from multiple files", () => {
    const a = writeFile("A.md", "keep\nremove\n");
    const b = writeFile("B.md", "remove\nkeep\n");
    removeDeadRules([makeDeadRuleFinding(a, 2), makeDeadRuleFinding(b, 1)]);
    expect(readFile(a)).toBe("keep\n");
    expect(readFile(b)).toBe("keep\n");
  });

  it("returns 0 for no autoFixable dead-rule findings", () => {
    const count = removeDeadRules([
      {
        severity: "info",
        category: "structure",
        file: "/dev/null",
        line: 1,
        messageKey: "test",
        suggestion: "no fix",
        autoFixable: false,
      },
    ]);
    expect(count).toBe(0);
  });

  it("deduplicates line numbers (does not double-remove)", () => {
    const path = writeFile("CLAUDE.md", "remove\nkeep\n");
    const count = removeDeadRules([
      makeDeadRuleFinding(path, 1),
      makeDeadRuleFinding(path, 1), // same line twice
    ]);
    expect(count).toBe(1);
    expect(readFile(path)).toBe("keep\n");
  });
});

// ─── removeStaleRefs ──────────────────────────────────────────────────────────

describe("removeStaleRefs", () => {
  it("removes lines with stale references", () => {
    const path = writeFile("CLAUDE.md", "valid line\nstale ref line\nanother\n");
    const count = removeStaleRefs([makeStaleRefFinding(path, 2)]);
    expect(count).toBe(1);
    expect(readFile(path)).toBe("valid line\nanother\n");
  });

  it("returns 0 for non-autoFixable stale-ref findings", () => {
    const count = removeStaleRefs([
      {
        ...makeStaleRefFinding("/dev/null", 1),
        autoFixable: false,
      },
    ]);
    expect(count).toBe(0);
  });
});

// ─── deduplicateRules ─────────────────────────────────────────────────────────

describe("deduplicateRules", () => {
  it("removes the duplicate (later) line, keeps the original", () => {
    const path = writeFile(
      "CLAUDE.md",
      "original\nsome other\nduplicate of line 1\n",
    );
    const count = deduplicateRules([makeDuplicateFinding(path, 3)]);
    expect(count).toBe(1);
    expect(readFile(path)).toBe("original\nsome other\n");
  });

  it("returns 0 for near-duplicate findings (autoFixable: false)", () => {
    const count = deduplicateRules([
      {
        severity: "info",
        category: "duplicate",
        file: "/dev/null",
        line: 1,
        messageKey: "deadRule.nearDuplicate",
        suggestion: "Near-duplicate",
        autoFixable: false, // near-duplicates are NOT auto-fixable
      },
    ]);
    expect(count).toBe(0);
  });
});

// ─── Integration: fix on sample-project copy ─────────────────────────────────

describe("fix integration: sample-project copy", () => {
  it("removes dead rules, stale refs, and duplicates from a project copy", () => {
    // Copy sample-project to temp dir
    cpSync(SAMPLE_PROJECT, tmpDir, { recursive: true });
    const claudeMdPath = join(tmpDir, "CLAUDE.md");

    const originalLines = readFile(claudeMdPath).split("\n");
    const originalLineCount = originalLines.length;

    // Simulate findings pointing to lines in the temp copy
    const findings: Finding[] = [
      makeDeadRuleFinding(claudeMdPath, 16),   // "Always use TypeScript strict mode"
      makeStaleRefFinding(claudeMdPath, 54),   // src/legacy/OldService.ts
      makeDuplicateFinding(claudeMdPath, 130), // duplicate commit message line
    ];

    const deadCount = removeDeadRules(findings);
    const staleCount = removeStaleRefs(findings);
    const dupeCount = deduplicateRules(findings);

    const newLines = readFile(claudeMdPath).split("\n");

    expect(deadCount).toBe(1);
    expect(staleCount).toBe(1);
    expect(dupeCount).toBe(1);
    expect(newLines.length).toBe(originalLineCount - 3);
  });
});
