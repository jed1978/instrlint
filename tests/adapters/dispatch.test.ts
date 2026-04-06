import { describe, it, expect, beforeAll } from "vitest";
import { loadProject } from "../../src/adapters/dispatch.js";
import { ensureInitialized } from "../../src/detectors/token-estimator.js";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const fixturesDir = join(__dirname, "..", "fixtures");

beforeAll(async () => {
  await ensureInitialized();
});

describe("loadProject dispatcher", () => {
  it("routes claude-code to claude-code adapter", () => {
    const root = join(fixturesDir, "sample-project");
    const result = loadProject(root, "claude-code");
    expect(result.tool).toBe("claude-code");
    expect(result.rootFile).toBeDefined();
  });

  it("routes codex to codex adapter", () => {
    const root = join(fixturesDir, "codex-project");
    const result = loadProject(root, "codex");
    expect(result.tool).toBe("codex");
    expect(result.rootFile).toBeDefined();
  });

  it("routes cursor to cursor adapter", () => {
    const root = join(fixturesDir, "cursor-project");
    const result = loadProject(root, "cursor");
    expect(result.tool).toBe("cursor");
    expect(result.rootFile).toBeDefined();
  });

  it("falls back to claude-code for unknown tool", () => {
    const root = join(fixturesDir, "sample-project");
    const result = loadProject(root, "unknown");
    expect(result.tool).toBe("claude-code");
  });
});
