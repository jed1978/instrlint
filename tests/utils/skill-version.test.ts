import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  checkSkillUpdate,
  injectVersion,
  CURRENT_VERSION,
} from "../../src/utils/skill-version.js";
import { join } from "path";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";

// ─── injectVersion ────────────────────────────────────────────────────────────

describe("injectVersion", () => {
  const base = `---\nname: instrlint\ndescription: test\n---\n# content`;

  it("injects instrlint-version into frontmatter", () => {
    const result = injectVersion(base, "1.2.3");
    expect(result).toContain("instrlint-version: 1.2.3");
  });

  it("places version inside the frontmatter block", () => {
    const result = injectVersion(base, "1.2.3");
    const fmEnd = result.indexOf("---", 4);
    const fmBlock = result.slice(0, fmEnd);
    expect(fmBlock).toContain("instrlint-version: 1.2.3");
  });

  it("preserves existing frontmatter fields", () => {
    const result = injectVersion(base, "1.2.3");
    expect(result).toContain("name: instrlint");
    expect(result).toContain("description: test");
  });

  it("preserves content after frontmatter", () => {
    const result = injectVersion(base, "1.2.3");
    expect(result).toContain("# content");
  });

  it("is idempotent — calling twice updates version, no duplicate keys", () => {
    const once = injectVersion(base, "1.0.0");
    const twice = injectVersion(once, "1.2.3");
    const matches = twice.match(/instrlint-version:/g);
    expect(matches).toHaveLength(1);
    expect(twice).toContain("instrlint-version: 1.2.3");
  });

  it("throws when content has no frontmatter", () => {
    expect(() =>
      injectVersion("# no frontmatter\nsome content", "1.0.0"),
    ).toThrow("no YAML frontmatter");
  });
});

// ─── CURRENT_VERSION ─────────────────────────────────────────────────────────

describe("CURRENT_VERSION", () => {
  it("is a valid semver string", () => {
    expect(CURRENT_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("matches package.json version", async () => {
    const { createRequire } = await import("module");
    const req = createRequire(import.meta.url);
    const pkg = req("../../package.json") as { version: string };
    expect(CURRENT_VERSION).toBe(pkg.version);
  });
});

// ─── checkSkillUpdate ─────────────────────────────────────────────────────────

describe("checkSkillUpdate", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "instrlint-skillver-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function writeSkill(version: string) {
    const dir = join(tempDir, ".claude", "commands");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "instrlint.md"),
      `---\nname: instrlint\ninstrlint-version: ${version}\n---\n`,
    );
  }

  it("returns null when no skill installed", () => {
    expect(checkSkillUpdate(tempDir)).toBeNull();
  });

  it("returns null when installed version matches current", () => {
    writeSkill(CURRENT_VERSION);
    expect(checkSkillUpdate(tempDir)).toBeNull();
  });

  it("returns update info when installed version is outdated", () => {
    writeSkill("0.0.1");
    const info = checkSkillUpdate(tempDir);
    expect(info).not.toBeNull();
    expect(info!.installedVersion).toBe("0.0.1");
    expect(info!.currentVersion).toBe(CURRENT_VERSION);
    expect(info!.isProject).toBe(true);
  });

  it("returns null when skill has no version field", () => {
    const dir = join(tempDir, ".claude", "commands");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "instrlint.md"),
      `---\nname: instrlint\n---\n# no version`,
    );
    expect(checkSkillUpdate(tempDir)).toBeNull();
  });
});
