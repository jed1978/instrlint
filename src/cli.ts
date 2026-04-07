#!/usr/bin/env node
import { Command } from "commander";
import { runAll } from "./commands/run-command.js";
import { runBudget } from "./commands/budget-command.js";
import { runDeadRules } from "./commands/deadrules-command.js";
import { runStructure } from "./commands/structure-command.js";
import { runCi } from "./commands/ci-command.js";
import { runInitCi } from "./commands/init-ci-command.js";
import { runInstall } from "./commands/install-command.js";
import { initLocale } from "./i18n/index.js";
import { CURRENT_VERSION } from "./utils/skill-version.js";
import type { FailOn } from "./commands/ci-command.js";

const program = new Command();

program
  .enablePositionalOptions()
  .name("instrlint")
  .description(
    "Lint and optimize your CLAUDE.md / AGENTS.md — find dead rules, token waste, and structural issues",
  )
  .version(CURRENT_VERSION)
  .option(
    "--format <type>",
    "output format (terminal|json|markdown)",
    "terminal",
  )
  .option("--lang <locale>", "output language (en|zh-TW)", "en")
  .option("--tool <name>", "force tool detection (claude-code|codex|cursor)")
  .option("--fix", "auto-fix safe issues (dead rules, stale refs, dupes)")
  .option("--force", "skip git clean check when using --fix")
  .option(
    "--emit-candidates <path>",
    "write low-confidence findings as candidates JSON for host LLM verification",
  )
  .option(
    "--apply-verdicts <path>",
    "apply host LLM verdicts from JSON file to the report",
  )
  .option(
    "--skip-report",
    "suppress terminal output (use with --emit-candidates)",
  )
  .action(async function (this: Command) {
    const opts = this.opts<{
      format: string;
      lang?: string;
      tool?: string;
      fix?: boolean;
      force?: boolean;
      emitCandidates?: string;
      applyVerdicts?: string;
      skipReport?: boolean;
    }>();
    const result = await runAll(opts);
    if (result.exitCode !== 0) process.exit(result.exitCode);
  });

program
  .command("budget")
  .description("Token budget analysis only")
  .option(
    "--format <type>",
    "output format (terminal|json|markdown)",
    "terminal",
  )
  .option("--lang <locale>", "output language (en|zh-TW)")
  .option("--tool <name>", "force tool detection (claude-code|codex|cursor)")
  .action(async function (this: Command) {
    const opts = this.opts<{ format: string; lang?: string; tool?: string }>();
    const lang = opts.lang ?? this.parent?.opts<{ lang?: string }>()?.lang;
    const result = await runBudget({
      ...opts,
      ...(lang !== undefined && { lang }),
    });
    if (result.exitCode !== 0) process.exit(result.exitCode);
  });

program
  .command("deadrules")
  .description("Dead rule detection only")
  .option("--format <type>", "output format (terminal|json)", "terminal")
  .option("--lang <locale>", "output language (en|zh-TW)")
  .option("--tool <name>", "force tool detection (claude-code|codex|cursor)")
  .action(async function (this: Command) {
    const opts = this.opts<{ format: string; lang?: string; tool?: string }>();
    const lang = opts.lang ?? this.parent?.opts<{ lang?: string }>()?.lang;
    const result = await runDeadRules({
      ...opts,
      ...(lang !== undefined && { lang }),
    });
    if (result.exitCode !== 0) process.exit(result.exitCode);
  });

program
  .command("structure")
  .description("Structural analysis only")
  .option("--format <type>", "output format (terminal|json)", "terminal")
  .option("--lang <locale>", "output language (en|zh-TW)")
  .option("--tool <name>", "force tool detection (claude-code|codex|cursor)")
  .action(async function (this: Command) {
    const opts = this.opts<{ format: string; lang?: string; tool?: string }>();
    const lang = opts.lang ?? this.parent?.opts<{ lang?: string }>()?.lang;
    const result = await runStructure({
      ...opts,
      ...(lang !== undefined && { lang }),
    });
    if (result.exitCode !== 0) process.exit(result.exitCode);
  });

program
  .command("ci")
  .description(
    "CI mode: run full analysis and exit 1 if findings exceed threshold",
  )
  .option(
    "--fail-on <level>",
    "failure threshold (critical|warning|info)",
    "critical",
  )
  .option("--format <type>", "output format (json|markdown|sarif)", "json")
  .option("--output <file>", "write output to file instead of stdout")
  .option("--tool <name>", "force tool detection (claude-code|codex|cursor)")
  .action(async function (this: Command) {
    const opts = this.opts<{
      failOn: string;
      format: string;
      output?: string;
      tool?: string;
    }>();
    const lang = this.parent?.opts<{ lang?: string }>()?.lang;
    initLocale(lang);
    const result = await runCi({
      failOn: opts.failOn as FailOn,
      format: opts.format,
      ...(opts.output !== undefined && { output: opts.output }),
      ...(opts.tool !== undefined && { tool: opts.tool }),
      ...(lang !== undefined && { lang }),
    });
    if (result.exitCode !== 0) process.exit(result.exitCode);
  });

program
  .command("init-ci")
  .description("Generate CI configuration for instrlint")
  .option("--github", "Generate GitHub Actions workflow")
  .option("--gitlab", "Generate GitLab CI snippet (prints to stdout)")
  .option("--force", "overwrite existing files")
  .action(function (this: Command) {
    const opts = this.opts<{
      github?: boolean;
      gitlab?: boolean;
      force?: boolean;
    }>();
    const result = runInitCi(opts);
    if (result.exitCode !== 0) process.exit(result.exitCode);
  });

program
  .command("install")
  .description("Install instrlint as a skill")
  .option("--claude-code", "Install as Claude Code skill")
  .option("--codex", "Install as Codex skill")
  .option("--project", "Install into current project (instead of global)")
  .option("--force", "overwrite existing skill file")
  .action(function (this: Command) {
    const opts = this.opts<{
      claudeCode?: boolean;
      codex?: boolean;
      project?: boolean;
      force?: boolean;
    }>();
    const result = runInstall(opts);
    if (result.exitCode !== 0) process.exit(result.exitCode);
  });

program.parse();
