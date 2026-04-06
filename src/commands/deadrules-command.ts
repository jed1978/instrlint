import chalk from 'chalk';
import { analyzeDeadRules } from '../analyzers/dead-rules.js';
import { loadClaudeCodeProject } from '../adapters/claude-code.js';
import { ensureInitialized } from '../detectors/token-estimator.js';
import { scanProject } from '../core/scanner.js';
import type { Finding } from '../types.js';

// ─── Terminal output ──────────────────────────────────────────────────────────

export function printDeadRulesTerminal(findings: Finding[]): void {
  const overlaps = findings.filter((f) => f.category === 'dead-rule');
  const duplicates = findings.filter((f) => f.category === 'duplicate');

  console.log('');
  console.log(chalk.bold.white('  DEAD RULES'));
  console.log(chalk.gray('  ─'.repeat(30)));

  if (overlaps.length > 0) {
    console.log(chalk.bold('  Redundant (enforced by config)'));
    for (const f of overlaps) {
      console.log(`  ${chalk.yellow('⚠')}  ${f.suggestion}`);
    }
    console.log('');
  }

  if (duplicates.length > 0) {
    console.log(chalk.bold('  Duplicates'));
    for (const f of duplicates) {
      const icon = f.severity === 'warning' ? chalk.yellow('⚠') : chalk.blue('ℹ');
      console.log(`  ${icon}  ${f.suggestion}`);
    }
    console.log('');
  }

  console.log(chalk.gray('  ─'.repeat(30)));

  if (findings.length === 0) {
    console.log(chalk.green('  ✓ No dead rules found'));
  } else {
    const parts: string[] = [];
    if (overlaps.length > 0) parts.push(`${overlaps.length} redundant rule${overlaps.length > 1 ? 's' : ''}`);
    if (duplicates.length > 0) parts.push(`${duplicates.length} duplicate${duplicates.length > 1 ? 's' : ''}`);
    console.log(chalk.yellow(`  ${parts.join(', ')} found`));
  }
  console.log('');
}

// ─── Core run logic ───────────────────────────────────────────────────────────

export interface DeadRulesCommandOpts {
  format: string;
  tool?: string;
  projectRoot?: string;
}

export interface DeadRulesCommandResult {
  exitCode: number;
  errorMessage?: string;
}

export async function runDeadRules(
  opts: DeadRulesCommandOpts,
  output: { log: typeof console.log; error: typeof console.error } = console,
): Promise<DeadRulesCommandResult> {
  await ensureInitialized();

  const projectRoot = opts.projectRoot ?? process.cwd();
  const scan = scanProject(projectRoot, opts.tool);

  if (scan.tool === 'unknown') {
    output.error(
      'No agent instruction files found. Run this command in a project that uses Claude Code, Codex, or Cursor.',
    );
    return { exitCode: 1, errorMessage: 'unknown tool' };
  }

  if (scan.rootFilePath === null) {
    output.error(`Found ${scan.tool} configuration but no root instruction file.`);
    return { exitCode: 1, errorMessage: 'missing root file' };
  }

  const instructions = loadClaudeCodeProject(projectRoot);
  const { findings } = analyzeDeadRules(instructions, projectRoot);

  if (opts.format === 'json') {
    output.log(JSON.stringify({ findings }, null, 2));
    return { exitCode: 0 };
  }

  printDeadRulesTerminal(findings);
  return { exitCode: 0 };
}
