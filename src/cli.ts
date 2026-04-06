#!/usr/bin/env node
import { Command } from "commander";
import { runAll } from "./commands/run-command.js";
import { runBudget } from "./commands/budget-command.js";
import { runDeadRules } from "./commands/deadrules-command.js";
import { runStructure } from "./commands/structure-command.js";

const program = new Command();

program
  .enablePositionalOptions()
  .name("instrlint")
  .description(
    "Lint and optimize your CLAUDE.md / AGENTS.md — find dead rules, token waste, and structural issues",
  )
  .version("0.1.0")
  .option(
    "--format <type>",
    "output format (terminal|json|markdown)",
    "terminal",
  )
  .option("--lang <locale>", "output language (en|zh-TW)", "en")
  .option("--tool <name>", "force tool detection (claude-code|codex|cursor)")
  .option("--fix", "auto-fix safe issues (dead rules, stale refs, dupes)")
  .option("--force", "skip git clean check when using --fix")
  .action(async function (this: Command) {
    const opts = this.opts<{
      format: string;
      lang?: string;
      tool?: string;
      fix?: boolean;
      force?: boolean;
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
  .option("--tool <name>", "force tool detection (claude-code|codex|cursor)")
  .action(async function (this: Command) {
    const opts = this.opts<{ format: string; tool?: string }>();
    const lang = this.parent?.opts<{ lang?: string }>()?.lang;
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
  .option("--tool <name>", "force tool detection (claude-code|codex|cursor)")
  .action(async function (this: Command) {
    const opts = this.opts<{ format: string; tool?: string }>();
    const lang = this.parent?.opts<{ lang?: string }>()?.lang;
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
  .option("--tool <name>", "force tool detection (claude-code|codex|cursor)")
  .action(async function (this: Command) {
    const opts = this.opts<{ format: string; tool?: string }>();
    const lang = this.parent?.opts<{ lang?: string }>()?.lang;
    const result = await runStructure({
      ...opts,
      ...(lang !== undefined && { lang }),
    });
    if (result.exitCode !== 0) process.exit(result.exitCode);
  });

program
  .command("install")
  .description("Install instrlint as a skill")
  .option("--claude-code", "Install as Claude Code skill")
  .option("--codex", "Install as Codex skill")
  .action(() => {
    process.stderr.write("install: not yet implemented\n");
    process.exit(1);
  });

program.parse();
