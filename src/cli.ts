#!/usr/bin/env node
import { Command } from 'commander';

const NOT_IMPLEMENTED = 'Not implemented yet — coming in next session';

const program = new Command();

program
  .name('instrlint')
  .description('Lint and optimize your CLAUDE.md / AGENTS.md — find dead rules, token waste, and structural issues')
  .version('0.1.0')
  .option('--format <type>', 'output format (terminal|json|markdown)', 'terminal')
  .option('--lang <locale>', 'output language (en|zh-TW)', 'en')
  .option('--tool <name>', 'force tool detection (claude-code|codex|cursor)')
  .option('--fix', 'auto-fix safe issues (dead rules, stale refs, dupes)')
  .option('--force', 'skip git clean check when using --fix')
  .action(() => {
    console.log(NOT_IMPLEMENTED);
  });

program
  .command('budget')
  .description('Token budget analysis only')
  .action(() => {
    console.log(NOT_IMPLEMENTED);
  });

program
  .command('deadrules')
  .description('Dead rule detection only')
  .action(() => {
    console.log(NOT_IMPLEMENTED);
  });

program
  .command('structure')
  .description('Structural analysis only')
  .action(() => {
    console.log(NOT_IMPLEMENTED);
  });

program
  .command('install')
  .description('Install instrlint as a skill')
  .option('--claude-code', 'Install as Claude Code skill')
  .option('--codex', 'Install as Codex skill')
  .action(() => {
    console.log(NOT_IMPLEMENTED);
  });

program.parse();
