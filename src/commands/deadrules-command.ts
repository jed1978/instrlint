import chalk from 'chalk';
import { analyzeDeadRules } from '../analyzers/dead-rules.js';
import { loadClaudeCodeProject } from '../adapters/claude-code.js';
import { ensureInitialized } from '../detectors/token-estimator.js';
import { scanProject } from '../core/scanner.js';
import { t, plural, initLocale } from '../i18n/index.js';
import type { Finding } from '../types.js';

// ─── Terminal output ──────────────────────────────────────────────────────────

export function printDeadRulesTerminal(findings: Finding[]): void {
  const overlaps = findings.filter((f) => f.category === 'dead-rule');
  const duplicates = findings.filter((f) => f.category === 'duplicate');

  console.log('');
  console.log(chalk.bold.white(`  ${t('label.deadRules')}`));
  console.log(chalk.gray('  ─'.repeat(30)));

  if (overlaps.length > 0) {
    console.log(chalk.bold(`  ${t('label.redundantByConfig')}`));
    for (const f of overlaps) {
      console.log(`  ${chalk.yellow('⚠')}  ${t(f.messageKey, f.messageParams)}`);
    }
    console.log('');
  }

  if (duplicates.length > 0) {
    console.log(chalk.bold(`  ${t('label.duplicates')}`));
    for (const f of duplicates) {
      const icon = f.severity === 'warning' ? chalk.yellow('⚠') : chalk.blue('ℹ');
      console.log(`  ${icon}  ${t(f.messageKey, f.messageParams)}`);
    }
    console.log('');
  }

  console.log(chalk.gray('  ─'.repeat(30)));

  if (findings.length === 0) {
    console.log(chalk.green(`  ${t('status.noDeadRules')}`));
  } else {
    const parts: string[] = [];
    if (overlaps.length > 0)
      parts.push(t('summary.redundantRules', { count: String(overlaps.length), s: plural(overlaps.length) }));
    if (duplicates.length > 0)
      parts.push(t('summary.duplicates', { count: String(duplicates.length), s: plural(duplicates.length) }));
    console.log(chalk.yellow(`  ${t('summary.found', { parts: parts.join(', ') })}`));
  }
  console.log('');
}

// ─── Core run logic ───────────────────────────────────────────────────────────

export interface DeadRulesCommandOpts {
  format: string;
  tool?: string;
  lang?: string;
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
  initLocale(opts.lang);
  await ensureInitialized();

  const projectRoot = opts.projectRoot ?? process.cwd();
  const scan = scanProject(projectRoot, opts.tool);

  if (scan.tool === 'unknown') {
    output.error(t('error.unknownTool'));
    return { exitCode: 1, errorMessage: 'unknown tool' };
  }

  if (scan.rootFilePath === null) {
    output.error(t('error.missingRootFile', { tool: scan.tool }));
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
