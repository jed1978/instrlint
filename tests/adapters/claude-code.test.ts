import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "path";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
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

describe("loadClaudeCodeProject — sample-project", () => {
  let result: ReturnType<typeof loadClaudeCodeProject>;

  beforeAll(() => {
    result = loadClaudeCodeProject(SAMPLE_PROJECT);
  });

  it("tool is claude-code", () => {
    expect(result.tool).toBe("claude-code");
  });

  describe("rootFile", () => {
    it("path contains CLAUDE.md", () => {
      expect(result.rootFile.path).toContain("CLAUDE.md");
    });

    it("lineCount is > 0", () => {
      expect(result.rootFile.lineCount).toBeGreaterThan(0);
    });

    it("tokenCount is > 0", () => {
      expect(result.rootFile.tokenCount).toBeGreaterThan(0);
    });

    it("tokenMethod is set", () => {
      expect(["measured", "estimated"]).toContain(result.rootFile.tokenMethod);
    });

    it("lines array is populated", () => {
      expect(result.rootFile.lines.length).toBeGreaterThan(0);
    });
  });

  describe("rules", () => {
    it("has exactly 2 rule files (typescript.md, testing.md)", () => {
      expect(result.rules.length).toBe(2);
    });

    it("typescript.md has paths frontmatter", () => {
      const ts = result.rules.find((r) => r.path.includes("typescript"));
      expect(ts).toBeDefined();
      expect(ts?.paths).toBeDefined();
      expect(ts?.paths?.length).toBeGreaterThan(0);
    });

    it("testing.md has globs frontmatter", () => {
      const testing = result.rules.find((r) => r.path.includes("testing"));
      expect(testing).toBeDefined();
      expect(testing?.globs).toBeDefined();
      expect(testing?.globs?.length).toBeGreaterThan(0);
    });

    it("each rule has positive tokenCount", () => {
      for (const rule of result.rules) {
        expect(rule.tokenCount).toBeGreaterThan(0);
      }
    });
  });

  describe("skills", () => {
    it("has exactly 1 skill (deploy)", () => {
      expect(result.skills.length).toBe(1);
    });

    it("skill has skillName=deploy", () => {
      expect(result.skills[0]?.skillName).toBe("deploy");
    });

    it("skill has positive tokenCount", () => {
      expect(result.skills[0]?.tokenCount).toBeGreaterThan(0);
    });
  });

  describe("subFiles", () => {
    it("has exactly 1 sub-directory CLAUDE.md (src/components/)", () => {
      expect(result.subFiles.length).toBe(1);
    });

    it("subFile path contains components", () => {
      expect(result.subFiles[0]?.path).toContain("components");
    });

    it("subFile has positive tokenCount", () => {
      expect(result.subFiles[0]?.tokenCount).toBeGreaterThan(0);
    });
  });

  describe("mcpServers", () => {
    it("has exactly 2 MCP servers", () => {
      expect(result.mcpServers.length).toBe(2);
    });

    it('includes "github" server', () => {
      expect(result.mcpServers.some((s) => s.name === "github")).toBe(true);
    });

    it('includes "filesystem" server', () => {
      expect(result.mcpServers.some((s) => s.name === "filesystem")).toBe(true);
    });

    it("each server has positive estimatedTokens", () => {
      for (const server of result.mcpServers) {
        expect(server.estimatedTokens).toBeGreaterThan(0);
      }
    });
  });
});

describe("loadClaudeCodeProject — clean-project", () => {
  let result: ReturnType<typeof loadClaudeCodeProject>;

  beforeAll(() => {
    result = loadClaudeCodeProject(CLEAN_PROJECT);
  });

  it("tool is claude-code", () => {
    expect(result.tool).toBe("claude-code");
  });

  it("has a rootFile", () => {
    expect(result.rootFile.lineCount).toBeGreaterThan(0);
  });

  it("has no rules (no .claude/rules/ dir)", () => {
    expect(result.rules).toEqual([]);
  });

  it("has no skills", () => {
    expect(result.skills).toEqual([]);
  });

  it("has no subFiles", () => {
    expect(result.subFiles).toEqual([]);
  });

  it("has no mcpServers", () => {
    expect(result.mcpServers).toEqual([]);
  });
});

// ─── Error path tests ──────────────────────────────────────────────────────

describe("loadClaudeCodeProject — error paths", () => {
  let tmpRoot: string;

  beforeAll(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "instrlint-adapter-test-"));
  });

  afterAll(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("returns empty rootFile when no CLAUDE.md exists", () => {
    const dir = join(tmpRoot, "no-root");
    mkdirSync(join(dir, ".claude"), { recursive: true });
    const result = loadClaudeCodeProject(dir);
    expect(result.rootFile.lineCount).toBe(0);
    expect(result.rootFile.tokenCount).toBe(0);
  });

  it("skips malformed settings.json and returns empty mcpServers", () => {
    const dir = join(tmpRoot, "bad-settings");
    mkdirSync(join(dir, ".claude"), { recursive: true });
    writeFileSync(join(dir, ".claude", "settings.json"), "{ invalid json !!!");
    const result = loadClaudeCodeProject(dir);
    expect(result.mcpServers).toEqual([]);
  });

  it("settings.json without mcpServers key returns empty array", () => {
    const dir = join(tmpRoot, "no-mcp-key");
    mkdirSync(join(dir, ".claude"), { recursive: true });
    writeFileSync(
      join(dir, ".claude", "settings.json"),
      JSON.stringify({ someOtherKey: true }),
    );
    const result = loadClaudeCodeProject(dir);
    expect(result.mcpServers).toEqual([]);
  });

  it("reads settings.local.json when present", () => {
    const dir = join(tmpRoot, "local-settings");
    mkdirSync(join(dir, ".claude"), { recursive: true });
    writeFileSync(
      join(dir, ".claude", "settings.local.json"),
      JSON.stringify({ mcpServers: { myserver: { command: "npx" } } }),
    );
    const result = loadClaudeCodeProject(dir);
    expect(result.mcpServers.some((s) => s.name === "myserver")).toBe(true);
  });

  it("skill directory without SKILL.md is skipped", () => {
    const dir = join(tmpRoot, "skill-no-file");
    mkdirSync(join(dir, ".claude", "skills", "orphan"), { recursive: true });
    // no SKILL.md inside orphan/
    const result = loadClaudeCodeProject(dir);
    expect(result.skills).toEqual([]);
  });

  it("returns empty rules when .claude/rules/ does not exist", () => {
    const dir = join(tmpRoot, "no-rules");
    mkdirSync(join(dir, ".claude"), { recursive: true });
    const result = loadClaudeCodeProject(dir);
    expect(result.rules).toEqual([]);
  });
});
