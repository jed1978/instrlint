#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('instrlint')
  .description('Lint and optimize your CLAUDE.md / AGENTS.md — find dead rules, token waste, and structural issues')
  .version('0.1.0');

program.parse();
