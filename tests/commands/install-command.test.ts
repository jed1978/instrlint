import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runInstall } from "../../src/commands/install-command.js";
import { initLocale } from "../../src/i18n/index.js";
import { join } from "path";
import { existsSync, mkdtempSync, rmSync, readFileSync } from "fs";
import { tmpdir } from "os";

beforeEach(() => {
  initLocale("en");
});

const mockOutput = () => ({
  log: vi.fn(),
  error: vi.fn(),
});

describe("runInstall --claude-code (project)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "instrlint-install-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("installs SKILL.md into .claude/skills/instrlint/", () => {
    const out = mockOutput();
    const result = runInstall(
      { claudeCode: true, project: true, projectRoot: tempDir },
      out,
    );
    expect(result.exitCode).toBe(0);
    expect(
      existsSync(join(tempDir, ".claude", "skills", "instrlint", "SKILL.md")),
    ).toBe(true);
    expect(out.log).toHaveBeenCalled();
  });

  it("SKILL.md contains instrlint content", () => {
    const out = mockOutput();
    runInstall({ claudeCode: true, project: true, projectRoot: tempDir }, out);
    const content = readFileSync(
      join(tempDir, ".claude", "skills", "instrlint", "SKILL.md"),
      "utf8",
    );
    expect(content).toContain("instrlint");
  });

  it("fails without --force if file already exists", () => {
    const out = mockOutput();
    runInstall({ claudeCode: true, project: true, projectRoot: tempDir }, out);
    const out2 = mockOutput();
    const result2 = runInstall(
      { claudeCode: true, project: true, projectRoot: tempDir },
      out2,
    );
    expect(result2.exitCode).toBe(1);
    expect(out2.error).toHaveBeenCalled();
  });

  it("overwrites with --force", () => {
    const out = mockOutput();
    runInstall({ claudeCode: true, project: true, projectRoot: tempDir }, out);
    const out2 = mockOutput();
    const result2 = runInstall(
      { claudeCode: true, project: true, force: true, projectRoot: tempDir },
      out2,
    );
    expect(result2.exitCode).toBe(0);
  });
});

describe("runInstall --codex", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "instrlint-install-codex-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("installs SKILL.md into .agents/skills/instrlint/", () => {
    const out = mockOutput();
    const result = runInstall(
      { codex: true, projectRoot: tempDir },
      out,
    );
    expect(result.exitCode).toBe(0);
    expect(
      existsSync(join(tempDir, ".agents", "skills", "instrlint", "SKILL.md")),
    ).toBe(true);
  });
});

describe("runInstall no target", () => {
  it("returns exit 1 when no target specified", () => {
    const out = mockOutput();
    const result = runInstall({}, out);
    expect(result.exitCode).toBe(1);
    expect(out.error).toHaveBeenCalled();
  });
});
