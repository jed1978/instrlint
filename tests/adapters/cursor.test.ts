import { describe, it, expect, beforeAll } from "vitest";
import { loadCursorProject } from "../../src/adapters/cursor.js";
import { ensureInitialized } from "../../src/detectors/token-estimator.js";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const fixtureRoot = join(__dirname, "..", "fixtures", "cursor-project");

beforeAll(async () => {
  await ensureInitialized();
});

describe("loadCursorProject", () => {
  it("returns tool = cursor", () => {
    const result = loadCursorProject(fixtureRoot);
    expect(result.tool).toBe("cursor");
  });

  it("loads .cursorrules as root file", () => {
    const result = loadCursorProject(fixtureRoot);
    expect(result.rootFile.path).toMatch(/\.cursorrules$/);
    expect(result.rootFile.lineCount).toBeGreaterThan(0);
  });

  it("loads rules from .cursor/rules/", () => {
    const result = loadCursorProject(fixtureRoot);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]!.path).toMatch(/style\.md$/);
  });

  it("parses globs frontmatter from rule files", () => {
    const result = loadCursorProject(fixtureRoot);
    const rule = result.rules[0]!;
    expect(rule.globs).toBeDefined();
    expect(rule.globs!.length).toBeGreaterThan(0);
    expect(rule.globs).toContain("src/**/*.ts");
  });

  it("returns empty skills array (Cursor has no skills concept)", () => {
    const result = loadCursorProject(fixtureRoot);
    expect(result.skills).toHaveLength(0);
  });

  it("returns empty mcpServers if no .cursor/mcp.json", () => {
    const result = loadCursorProject(fixtureRoot);
    expect(result.mcpServers).toHaveLength(0);
  });

  it("returns empty root file if .cursorrules missing", () => {
    const result = loadCursorProject("/tmp/nonexistent-cursor-project");
    expect(result.rootFile.lineCount).toBe(0);
    expect(result.tool).toBe("cursor");
  });
});
