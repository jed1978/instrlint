import chalk from 'chalk';
import { analyzeStructure } from '../analyzers/structure.js';
import { loadClaudeCodeProject } from '../adapters/claude-code.js';
import { ensureInitialized } from '../detectors/token-estimator.js';
import { scanProject } from '../core/scanner.js';
import type { Finding } from '../types.js';

// ─── Terminal output ──────────────────────────────────────────────────────────

export function printStructureTerminal(findings: Finding[]): void {
  const contradictions = findings.filter((f) => f.category === 'contradiction');
  const staleRefs = findings.filter((f) => f.category === 'stale-ref');
  const scoped = findings.filter((f) => f.category === 'structure');

  console.log('');
  console.log(chalk.bold.white('  STRUCTURE'));
  console.log(chalk.gray('  ─'.repeat(30)));

  if (contradictions.length > 0) {
    console.log(chalk.bold('  Contradictions'));
    for (const f of contradictions) {
      console.log(`  ${chalk.red('✖')}  ${f.suggestion}`);
    }
    console.log('');
  }

  if (staleRefs.length > 0) {
    console.log(chalk.bold('  Stale References'));
    for (const f of staleRefs) {
      console.log(`  ${chalk.yellow('⚠')}  ${f.suggestion}`);
    }
    console.log('');
  }

  if (scoped.length > 0) {
    console.log(chalk.bold('  Refactoring Opportunities'));
    for (const f of scoped) {
      console.log(`  ${chalk.blue('ℹ')}  ${f.suggestion}`);
    }
    console.log('');
  }

  console.log(chalk.gray('  ─'.repeat(30)));

  if (findings.length === 0) {
    console.log(chalk.green('  ✓ No structural issues found'));
  } else {
    const parts: string[] = [];
    if (contradictions.length > 0)
      parts.push(`${contradictions.length} contradiction${contradictions.length > 1 ? 's' : ''}`);
    if (staleRefs.length > 0)
      parts.push(`${staleRefs.length} stale ref${staleRefs.length > 1 ? 's' : ''}`);
    if (scoped.length > 0)
      parts.push(`${scoped.length} refactoring suggestion${scoped.length > 1 ? 's' : ''}`);
    console.log(chalk.yellow(`  ${parts.join(', ')} found`));
  }
  console.log('');
}

// ─── Core run logic ───────────────────────────────────────────────────────────

export interface StructureCommandOpts {
  format: string;
  tool?: string;
  projectRoot?: string;
}

export interface StructureCommandResult {
  exitCode: number;
  errorMessage?: string;
}

export async function runStructure(
  opts: StructureCommandOpts,
  output: { log: typeof console.log; error: typeof console.error } = console,
): Promise<StructureCommandResult> {
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
  const { findings } = analyzeStructure(instructions, projectRoot);

  if (opts.format === 'json') {
    output.log(JSON.stringify({ findings }, null, 2));
    return { exitCode: 0 };
  }

  printStructureTerminal(findings);
  return { exitCode: 0 };
}
