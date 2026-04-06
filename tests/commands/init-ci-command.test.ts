import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runInitCi } from "../../src/commands/init-ci-command.js";
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

import { vi } from "vitest";

describe("runInitCi --github", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "instrlint-init-ci-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates .github/workflows/instrlint.yml", () => {
    const out = mockOutput();
    const result = runInitCi({ github: true, projectRoot: tempDir }, out);
    expect(result.exitCode).toBe(0);
    expect(existsSync(join(tempDir, ".github", "workflows", "instrlint.yml"))).toBe(true);
  });

  it("generated YAML contains paths trigger for CLAUDE.md", () => {
    const out = mockOutput();
    runInitCi({ github: true, projectRoot: tempDir }, out);
    const content = readFileSync(
      join(tempDir, ".github", "workflows", "instrlint.yml"),
      "utf8",
    );
    expect(content).toContain("CLAUDE.md");
    expect(content).toContain(".claude/**");
    expect(content).toContain("AGENTS.md");
  });

  it("generated YAML contains instrlint ci command", () => {
    const out = mockOutput();
    runInitCi({ github: true, projectRoot: tempDir }, out);
    const content = readFileSync(
      join(tempDir, ".github", "workflows", "instrlint.yml"),
      "utf8",
    );
    expect(content).toContain("instrlint");
    expect(content).toContain("sarif");
  });

  it("fails if file already exists without --force", () => {
    const out = mockOutput();
    runInitCi({ github: true, projectRoot: tempDir }, out);
    const out2 = mockOutput();
    const result2 = runInitCi({ github: true, projectRoot: tempDir }, out2);
    expect(result2.exitCode).toBe(1);
    expect(out2.error).toHaveBeenCalled();
  });

  it("overwrites with --force", () => {
    const out = mockOutput();
    runInitCi({ github: true, projectRoot: tempDir }, out);
    const out2 = mockOutput();
    const result2 = runInitCi(
      { github: true, force: true, projectRoot: tempDir },
      out2,
    );
    expect(result2.exitCode).toBe(0);
  });
});

describe("runInitCi --gitlab", () => {
  it("prints GitLab snippet to stdout", () => {
    const out = mockOutput();
    const result = runInitCi({ gitlab: true }, out);
    expect(result.exitCode).toBe(0);
    expect(out.log).toHaveBeenCalled();
    const logged = out.log.mock.calls[0]?.[0] as string;
    expect(logged).toContain("instrlint");
    expect(logged).toContain(".gitlab-ci.yml");
  });
});

describe("runInitCi no target", () => {
  it("returns exit 1 when neither --github nor --gitlab specified", () => {
    const out = mockOutput();
    const result = runInitCi({}, out);
    expect(result.exitCode).toBe(1);
  });
});
