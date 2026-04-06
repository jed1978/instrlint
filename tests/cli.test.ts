import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import { join } from "path";
import { execFileSync } from "child_process";
import {
  formatTokens,
  bar,
  pct,
  printBudgetTerminal,
  runBudget,
} from "../src/commands/budget-command.js";
import {
  printDeadRulesTerminal,
  runDeadRules,
} from "../src/commands/deadrules-command.js";
import { runAll } from "../src/commands/run-command.js";
import { ensureInitialized } from "../src/detectors/token-estimator.js";
import { initLocale } from "../src/i18n/index.js";
import type { BudgetSummary, Finding } from "../src/types.js";

const CLI = join(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "../dist/cli.js",
);

const SAMPLE_PROJECT = join(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "fixtures/sample-project",
);

const CLEAN_PROJECT = join(
  import.meta.dirname ?? new URL(".", import.meta.url).pathname,
  "fixtures/clean-project",
);

beforeAll(async () => {
  await ensureInitialized();
});

beforeEach(() => {
  initLocale("en");
});

// ─── Formatting helpers ────────────────────────────────────────────────────

describe("formatTokens", () => {
  it("measured: no tilde, no disclaimer", () => {
    expect(formatTokens(4217, "measured")).toBe("4,217 tokens");
  });

  it("estimated: tilde prefix and (estimated) suffix", () => {
    expect(formatTokens(4217, "estimated")).toBe("~4,217 tokens (estimated)");
  });

  it("formats large numbers with commas", () => {
    expect(formatTokens(100000, "measured")).toBe("100,000 tokens");
  });

  it("formats zero", () => {
    expect(formatTokens(0, "measured")).toBe("0 tokens");
  });
});

describe("bar", () => {
  it("returns all filled at fraction=1", () => {
    const result = bar(1, 4);
    // strip ANSI codes for assertion
    const stripped = result.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toBe("████");
  });

  it("returns all empty at fraction=0", () => {
    const result = bar(0, 4);
    const stripped = result.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toBe("░░░░");
  });

  it("returns half filled at fraction=0.5", () => {
    const result = bar(0.5, 4);
    const stripped = result.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toBe("██░░");
  });

  it("clamps fraction below 0", () => {
    const result = bar(-1, 4);
    const stripped = result.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toBe("░░░░");
  });

  it("clamps fraction above 1", () => {
    const result = bar(2, 4);
    const stripped = result.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toBe("████");
  });
});

describe("pct", () => {
  it("formats 0.25 as 25%", () => {
    expect(pct(0.25)).toBe("25%");
  });

  it("rounds to nearest integer", () => {
    expect(pct(0.333)).toBe("33%");
  });

  it("handles 0 and 1", () => {
    expect(pct(0)).toBe("0%");
    expect(pct(1)).toBe("100%");
  });
});

// ─── printBudgetTerminal ───────────────────────────────────────────────────

const mockSummary: BudgetSummary = {
  systemPromptTokens: 12000,
  rootFileTokens: 1000,
  rootFileMethod: "estimated",
  rulesTokens: 200,
  rulesMethod: "estimated",
  skillsTokens: 0,
  skillsMethod: "estimated",
  subFilesTokens: 0,
  subFilesMethod: "estimated",
  mcpTokens: 0,
  totalBaseline: 13200,
  availableTokens: 186800,
  fileBreakdown: [],
  tokenMethod: "estimated",
};

describe("printBudgetTerminal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("outputs TOKEN BUDGET header", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      lines.push(args.join(" "));
    });
    printBudgetTerminal(mockSummary, []);
    const combined = lines.join("\n");
    expect(combined).toContain("TOKEN BUDGET");
  });

  it("outputs no-issues message when findings is empty", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      lines.push(args.join(" "));
    });
    printBudgetTerminal(mockSummary, []);
    expect(lines.some((l) => l.includes("No budget issues found"))).toBe(true);
  });

  it("outputs finding suggestions when present", () => {
    const findings: Finding[] = [
      {
        severity: "warning",
        category: "budget",
        file: "CLAUDE.md",
        messageKey: "budget.rootFileWarning",
        messageParams: { lines: "206" },
        suggestion: "Root file is too long",
        autoFixable: false,
      },
    ];
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      lines.push(args.join(" "));
    });
    printBudgetTerminal(mockSummary, findings);
    expect(lines.some((l) => l.includes("206"))).toBe(true);
  });

  it("skips rows where tokens === 0", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      lines.push(args.join(" "));
    });
    printBudgetTerminal(mockSummary, []);
    // Skills and sub-dir files are 0 → should not appear in output
    expect(lines.some((l) => l.includes("Skill files"))).toBe(false);
    expect(lines.some((l) => l.includes("Sub-dir files"))).toBe(false);
  });
});

// ─── runBudget ─────────────────────────────────────────────────────────────

describe("runBudget", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns exitCode 0 for a valid project (terminal)", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(String(args[0] ?? ""));
    });
    const output = { log: console.log, error: (..._args: unknown[]) => {} };
    const result = await runBudget(
      { format: "terminal", projectRoot: CLEAN_PROJECT, lang: "en" },
      output,
    );
    expect(result.exitCode).toBe(0);
    expect(logs.some((l) => l.includes("TOKEN BUDGET"))).toBe(true);
  });

  it("returns exitCode 0 for json format", async () => {
    const logs: string[] = [];
    const output = {
      log: (...args: unknown[]) => {
        logs.push(String(args[0]));
      },
      error: (..._args: unknown[]) => {},
    };
    const result = await runBudget(
      { format: "json", projectRoot: SAMPLE_PROJECT },
      output,
    );
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(logs[0] ?? "{}");
    expect(parsed).toHaveProperty("summary");
    expect(parsed).toHaveProperty("findings");
  });

  it("returns exitCode 1 and error message for unknown tool", async () => {
    const { mkdtempSync } = await import("fs");
    const { tmpdir } = await import("os");
    const emptyDir = mkdtempSync(join(tmpdir(), "instrlint-test-"));

    const errors: string[] = [];
    const output = {
      log: (..._args: unknown[]) => {},
      error: (...args: unknown[]) => {
        errors.push(String(args[0]));
      },
    };
    const result = await runBudget(
      { format: "terminal", projectRoot: emptyDir, lang: "en" },
      output,
    );
    expect(result.exitCode).toBe(1);
    expect(errors[0]).toContain("No agent instruction files found");

    const { rmdirSync } = await import("fs");
    rmdirSync(emptyDir);
  });

  it("returns exitCode 1 when .claude/ exists but no CLAUDE.md", async () => {
    const { mkdtempSync, mkdirSync } = await import("fs");
    const { tmpdir } = await import("os");
    const dir = mkdtempSync(join(tmpdir(), "instrlint-test-"));
    mkdirSync(join(dir, ".claude"));

    const errors: string[] = [];
    const output = {
      log: (..._args: unknown[]) => {},
      error: (...args: unknown[]) => {
        errors.push(String(args[0]));
      },
    };
    const result = await runBudget(
      { format: "terminal", projectRoot: dir, lang: "en" },
      output,
    );
    expect(result.exitCode).toBe(1);
    expect(errors[0]).toContain("no root instruction file");

    const { rmSync } = await import("fs");
    rmSync(dir, { recursive: true, force: true });
  });
});

// ─── printDeadRulesTerminal ───────────────────────────────────────────────────

describe("printDeadRulesTerminal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("outputs DEAD RULES header", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      lines.push(args.join(" "));
    });
    printDeadRulesTerminal([]);
    expect(lines.some((l) => l.includes("DEAD RULES"))).toBe(true);
  });

  it("outputs no-issues message when findings is empty", () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      lines.push(args.join(" "));
    });
    printDeadRulesTerminal([]);
    expect(lines.some((l) => l.includes("No dead rules found"))).toBe(true);
  });

  it("outputs dead-rule suggestion when present", () => {
    const findings: Finding[] = [
      {
        severity: "warning",
        category: "dead-rule",
        file: "CLAUDE.md",
        line: 16,
        messageKey: "deadRule.configOverlap",
        messageParams: {
          rule: "Always use strict mode",
          config: "tsconfig.json (compilerOptions.strict: true)",
        },
        suggestion: "Rule already enforced by tsconfig.json",
        autoFixable: true,
      },
    ];
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      lines.push(args.join(" "));
    });
    printDeadRulesTerminal(findings);
    // t() renders "Rule "..." is already enforced by tsconfig.json (...)"
    expect(lines.some((l) => l.includes("tsconfig.json"))).toBe(true);
  });

  it("outputs duplicate suggestion when present", () => {
    const findings: Finding[] = [
      {
        severity: "warning",
        category: "duplicate",
        file: "CLAUDE.md",
        line: 130,
        messageKey: "deadRule.exactDuplicate",
        messageParams: { otherLine: "37", otherFile: "CLAUDE.md" },
        suggestion: "Exact duplicate of line 37 in CLAUDE.md",
        autoFixable: true,
      },
    ];
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      lines.push(args.join(" "));
    });
    printDeadRulesTerminal(findings);
    expect(lines.some((l) => l.includes("Exact duplicate of line 37"))).toBe(
      true,
    );
  });
});

// ─── runDeadRules ────────────────────────────────────────────────────────────

describe("runDeadRules", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns exitCode 0 for a valid project (terminal)", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const output = { log: console.log, error: (..._args: unknown[]) => {} };
    const result = await runDeadRules(
      { format: "terminal", projectRoot: CLEAN_PROJECT },
      output,
    );
    expect(result.exitCode).toBe(0);
  });

  it("returns exitCode 0 for json format", async () => {
    const logs: string[] = [];
    const output = {
      log: (...args: unknown[]) => {
        logs.push(String(args[0]));
      },
      error: (..._args: unknown[]) => {},
    };
    const result = await runDeadRules(
      { format: "json", projectRoot: SAMPLE_PROJECT },
      output,
    );
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(logs[0] ?? "{}");
    expect(parsed).toHaveProperty("findings");
  });

  it("returns exitCode 1 for unknown tool (empty dir)", async () => {
    const { mkdtempSync } = await import("fs");
    const { tmpdir } = await import("os");
    const emptyDir = mkdtempSync(`${tmpdir()}/instrlint-dr-test-`);

    const errors: string[] = [];
    const output = {
      log: (..._args: unknown[]) => {},
      error: (...args: unknown[]) => {
        errors.push(String(args[0]));
      },
    };
    const result = await runDeadRules(
      { format: "terminal", projectRoot: emptyDir, lang: "en" },
      output,
    );
    expect(result.exitCode).toBe(1);
    expect(errors[0]).toContain("No agent instruction files found");

    const { rmdirSync } = await import("fs");
    rmdirSync(emptyDir);
  });
});

// ─── CLI smoke tests (dist) ────────────────────────────────────────────────

function runCli(args: string[]): {
  stdout: string;
  stderr: string;
  code: number;
} {
  try {
    const stdout = execFileSync("node", [CLI, ...args], { encoding: "utf8" });
    return { stdout, stderr: "", code: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      code: e.status ?? 1,
    };
  }
}

// ─── runAll ──────────────────────────────────────────────────────────────────

describe("runAll", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns exitCode 0 for terminal format on sample-project", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const result = await runAll({
      format: "terminal",
      projectRoot: SAMPLE_PROJECT,
    });
    expect(result.exitCode).toBe(0);
  });

  it("terminal output contains score and project name", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      logs.push(String(args[0] ?? ""));
    });
    await runAll({ format: "terminal", projectRoot: SAMPLE_PROJECT });
    const output = logs.join("\n");
    expect(output).toContain("sample-project");
    expect(output).toMatch(/\d+\/100/); // score like "72/100"
  });

  it("json format outputs valid HealthReport JSON", async () => {
    const logs: string[] = [];
    const output = {
      log: (...args: unknown[]) => logs.push(String(args[0])),
      error: (..._args: unknown[]) => {},
    };
    const result = await runAll(
      { format: "json", projectRoot: SAMPLE_PROJECT },
      output,
    );
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(logs[0] ?? "{}");
    expect(parsed).toHaveProperty("score");
    expect(parsed).toHaveProperty("grade");
    expect(parsed).toHaveProperty("findings");
    expect(parsed).toHaveProperty("budget");
    expect(parsed).toHaveProperty("actionPlan");
    expect(typeof parsed.score).toBe("number");
  });

  it("markdown format output starts with # instrlint Health Report", async () => {
    const logs: string[] = [];
    const output = {
      log: (...args: unknown[]) => logs.push(String(args[0])),
      error: (..._args: unknown[]) => {},
    };
    const result = await runAll(
      { format: "markdown", projectRoot: SAMPLE_PROJECT, lang: "en" },
      output,
    );
    expect(result.exitCode).toBe(0);
    expect(logs[0]).toMatch(/^# instrlint Health Report/);
  });

  it("returns exitCode 1 for unknown tool", async () => {
    const { mkdtempSync, rmdirSync } = await import("fs");
    const { tmpdir } = await import("os");
    const emptyDir = mkdtempSync(`${tmpdir()}/instrlint-run-test-`);
    const errors: string[] = [];
    const output = {
      log: (..._args: unknown[]) => {},
      error: (...args: unknown[]) => errors.push(String(args[0])),
    };
    const result = await runAll(
      { format: "terminal", projectRoot: emptyDir },
      output,
    );
    expect(result.exitCode).toBe(1);
    rmdirSync(emptyDir);
  });

  it("clean-project produces score 100 with no critical or warning findings", async () => {
    const logs: string[] = [];
    const output = {
      log: (...args: unknown[]) => logs.push(String(args[0])),
      error: (..._args: unknown[]) => {},
    };
    await runAll({ format: "json", projectRoot: CLEAN_PROJECT }, output);
    const parsed = JSON.parse(logs[0] ?? "{}");
    const criticals = (parsed.findings as Finding[]).filter(
      (f: Finding) => f.severity === "critical" || f.severity === "warning",
    );
    expect(criticals).toHaveLength(0);
    expect(parsed.score).toBe(100);
  });
});

// ─── CLI smoke tests (dist) ────────────────────────────────────────────────

describe("CLI smoke tests (dist)", () => {
  it("--help lists all subcommands", () => {
    const { stdout, code } = runCli(["--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("budget");
    expect(stdout).toContain("deadrules");
    expect(stdout).toContain("structure");
    expect(stdout).toContain("install");
  });

  it("--version prints version", () => {
    const { stdout, code } = runCli(["--version"]);
    expect(code).toBe(0);
    expect(stdout).toContain("0.1.0");
  });

  it("budget outputs TOKEN BUDGET", () => {
    const { stdout, code } = runCli(["budget"]);
    expect(code).toBe(0);
    expect(stdout).toContain("TOKEN BUDGET");
  });

  it("budget --format json outputs valid JSON", () => {
    const { stdout, code } = runCli(["budget", "--format", "json"]);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty("summary");
    expect(parsed).toHaveProperty("findings");
  });

  it("deadrules outputs DEAD RULES", () => {
    const { stdout, code } = runCli(["deadrules"]);
    expect(code).toBe(0);
    expect(stdout).toContain("DEAD RULES");
  });

  it("deadrules --format json outputs valid JSON with findings array", () => {
    const { stdout, code } = runCli(["deadrules", "--format", "json"]);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty("findings");
    expect(Array.isArray(parsed.findings)).toBe(true);
  });
});
