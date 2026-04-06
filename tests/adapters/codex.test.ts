import { describe, it, expect, beforeAll } from "vitest";
import { loadCodexProject } from "../../src/adapters/codex.js";
import { ensureInitialized } from "../../src/detectors/token-estimator.js";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const fixtureRoot = join(__dirname, "..", "fixtures", "codex-project");

beforeAll(async () => {
  await ensureInitialized();
});

describe("loadCodexProject", () => {
  it("returns tool = codex", () => {
    const result = loadCodexProject(fixtureRoot);
    expect(result.tool).toBe("codex");
  });

  it("loads AGENTS.md as root file", () => {
    const result = loadCodexProject(fixtureRoot);
    expect(result.rootFile.path).toMatch(/AGENTS\.md$/);
    expect(result.rootFile.lineCount).toBeGreaterThan(0);
  });

  it("loads skills from .agents/skills/", () => {
    const result = loadCodexProject(fixtureRoot);
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0]!.skillName).toBe("search");
  });

  it("parses MCP servers from .codex/config.toml", () => {
    const result = loadCodexProject(fixtureRoot);
    expect(result.mcpServers).toHaveLength(2);
    const names = result.mcpServers.map((s) => s.name);
    expect(names).toContain("github");
    expect(names).toContain("filesystem");
  });

  it("filesystem server has toolCount from tools array", () => {
    const result = loadCodexProject(fixtureRoot);
    const fs = result.mcpServers.find((s) => s.name === "filesystem");
    expect(fs?.toolCount).toBe(3);
  });

  it("returns empty root file if AGENTS.md missing", () => {
    const result = loadCodexProject("/tmp/nonexistent-codex-project");
    expect(result.rootFile.lineCount).toBe(0);
    expect(result.tool).toBe("codex");
  });

  it("returns empty arrays for rules and subFiles", () => {
    const result = loadCodexProject(fixtureRoot);
    expect(result.rules).toHaveLength(0);
    expect(result.subFiles).toHaveLength(0);
  });

  it("does not crash on missing .codex/config.toml", () => {
    const result = loadCodexProject(join(__dirname, "..", "fixtures", "clean-project"));
    expect(result.mcpServers).toHaveLength(0);
  });
});
