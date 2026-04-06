import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { scanProject } from "../../src/core/scanner.js";

const SAMPLE_PROJECT = join(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../fixtures/sample-project",
);

const CLEAN_PROJECT = join(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../fixtures/clean-project",
);

// ─── Temp directory helpers ────────────────────────────────────────────────

let tmpRoot: string;

beforeAll(() => {
  tmpRoot = join(tmpdir(), `instrlint-test-${Date.now()}`);
  mkdirSync(tmpRoot, { recursive: true });
});

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

function makeTmpDir(name: string): string {
  const dir = join(tmpRoot, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("scanProject", () => {
  describe("sample-project", () => {
    it("detects claude-code via .claude/ directory", () => {
      const result = scanProject(SAMPLE_PROJECT);
      expect(result.tool).toBe("claude-code");
      expect(result.configDir).toContain(".claude");
      expect(result.confidence).toBe("high");
    });

    it("rootFilePath points to an existing CLAUDE.md", () => {
      const result = scanProject(SAMPLE_PROJECT);
      expect(result.rootFilePath).not.toBeNull();
      expect(result.rootFilePath).toContain("CLAUDE.md");
    });
  });

  describe("clean-project", () => {
    it("detects claude-code via CLAUDE.md root file with low confidence", () => {
      const result = scanProject(CLEAN_PROJECT);
      expect(result.tool).toBe("claude-code");
      // clean-project has no .claude/ dir → confidence must be 'low'
      expect(result.confidence).toBe("low");
    });

    it("rootFilePath is non-null", () => {
      const result = scanProject(CLEAN_PROJECT);
      expect(result.rootFilePath).not.toBeNull();
    });
  });

  describe("empty directory", () => {
    it("returns unknown with no root file", () => {
      const dir = makeTmpDir("empty");
      const result = scanProject(dir);
      expect(result.tool).toBe("unknown");
      expect(result.rootFilePath).toBeNull();
      expect(result.configDir).toBeNull();
    });
  });

  describe("--tool force", () => {
    it("overrides detection with forceTool", () => {
      const dir = makeTmpDir("force-tool");
      // No .claude/ or CLAUDE.md — tool would normally be unknown
      const result = scanProject(dir, "codex");
      expect(result.tool).toBe("codex");
      expect(result.confidence).toBe("high");
    });

    it("still finds rootFilePath when forceTool matches a detected tool", () => {
      const result = scanProject(SAMPLE_PROJECT, "claude-code");
      expect(result.tool).toBe("claude-code");
      expect(result.rootFilePath).toContain("CLAUDE.md");
    });

    it("throws for invalid forceTool value", () => {
      const dir = makeTmpDir("invalid-tool");
      expect(() => scanProject(dir, "vscode")).toThrow(/Invalid tool/);
    });
  });

  describe("ambiguous: multiple tools detected", () => {
    it("returns confidence=ambiguous when both .claude/ and .agents/ exist", () => {
      const dir = makeTmpDir("ambiguous");
      mkdirSync(join(dir, ".claude"), { recursive: true });
      mkdirSync(join(dir, ".agents"), { recursive: true });
      writeFileSync(join(dir, "CLAUDE.md"), "# Test");

      const result = scanProject(dir);
      expect(result.confidence).toBe("ambiguous");
      // First match wins: claude-code (checked before codex)
      expect(result.tool).toBe("claude-code");
    });
  });

  describe("error handling", () => {
    it("throws when projectRoot does not exist", () => {
      expect(() => scanProject("/this/path/does/not/exist/anywhere")).toThrow(
        /does not exist/,
      );
    });
  });

  describe("root-file-only detection", () => {
    it("detects claude-code via bare CLAUDE.md (no .claude/ dir)", () => {
      const dir = makeTmpDir("bare-claude-md");
      writeFileSync(join(dir, "CLAUDE.md"), "# Minimal");
      const result = scanProject(dir);
      expect(result.tool).toBe("claude-code");
      expect(result.confidence).toBe("low");
    });

    it("detects codex via bare AGENTS.md (no .agents/ dir)", () => {
      const dir = makeTmpDir("bare-agents-md");
      writeFileSync(join(dir, "AGENTS.md"), "# Minimal");
      const result = scanProject(dir);
      expect(result.tool).toBe("codex");
      expect(result.confidence).toBe("low");
    });
  });
});
