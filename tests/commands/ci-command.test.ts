import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { runCi } from "../../src/commands/ci-command.js";
import { ensureInitialized } from "../../src/detectors/token-estimator.js";
import { initLocale } from "../../src/i18n/index.js";
import { join } from "path";
import { fileURLToPath } from "url";
import { existsSync, unlinkSync } from "fs";
import { tmpdir } from "os";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const fixturesDir = join(__dirname, "..", "fixtures");

beforeAll(async () => {
  await ensureInitialized();
  initLocale("en");
});

afterEach(() => {
  vi.restoreAllMocks();
});

const mockOutput = () => ({
  log: vi.fn(),
  error: vi.fn(),
});

describe("runCi", () => {
  it("returns exit 0 for clean project with default --fail-on critical", async () => {
    const out = mockOutput();
    const result = await runCi(
      {
        projectRoot: join(fixturesDir, "clean-project"),
        format: "json",
      },
      out,
    );
    expect(result.exitCode).toBe(0);
  });

  it("returns exit 1 for sample-project with --fail-on warning", async () => {
    const out = mockOutput();
    const result = await runCi(
      {
        projectRoot: join(fixturesDir, "sample-project"),
        failOn: "warning",
        format: "json",
      },
      out,
    );
    expect(result.exitCode).toBe(1);
  });

  it("returns exit 1 for sample-project with --fail-on critical (has contradictions)", async () => {
    const out = mockOutput();
    const result = await runCi(
      {
        projectRoot: join(fixturesDir, "sample-project"),
        failOn: "critical",
        format: "json",
      },
      out,
    );
    expect(result.exitCode).toBe(1);
  });

  it("--format json outputs valid JSON to stdout", async () => {
    const out = mockOutput();
    await runCi(
      {
        projectRoot: join(fixturesDir, "clean-project"),
        format: "json",
      },
      out,
    );
    const logged = out.log.mock.calls[0]?.[0] as string;
    expect(() => JSON.parse(logged)).not.toThrow();
  });

  it("--format sarif outputs valid SARIF JSON", async () => {
    const out = mockOutput();
    await runCi(
      {
        projectRoot: join(fixturesDir, "clean-project"),
        format: "sarif",
      },
      out,
    );
    const logged = out.log.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(logged);
    expect(parsed.version).toBe("2.1.0");
    expect(parsed.runs).toHaveLength(1);
  });

  it("--output writes to file and logs to stderr", async () => {
    const outFile = join(tmpdir(), `instrlint-ci-test-${Date.now()}.json`);
    const out = mockOutput();
    try {
      await runCi(
        {
          projectRoot: join(fixturesDir, "clean-project"),
          format: "json",
          output: outFile,
        },
        out,
      );
      expect(existsSync(outFile)).toBe(true);
      expect(out.log).not.toHaveBeenCalled(); // no stdout
      expect(out.error).toHaveBeenCalled(); // stderr summary
    } finally {
      if (existsSync(outFile)) unlinkSync(outFile);
    }
  });

  it("returns exit 1 for unknown tool", async () => {
    const out = mockOutput();
    const result = await runCi(
      { projectRoot: tmpdir() },
      out,
    );
    expect(result.exitCode).toBe(1);
  });
});
