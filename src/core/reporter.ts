import chalk from 'chalk';
import type { Finding, HealthReport } from '../types.js';
import { printBudgetTerminal } from '../commands/budget-command.js';
import { printDeadRulesTerminal } from '../commands/deadrules-command.js';
import { printStructureTerminal } from '../commands/structure-command.js';

// ─── Grade colour ──────────────────────────────────────────────────────────────

function gradeColour(grade: string): string {
  if (grade === 'A') return chalk.bold.green(grade);
  if (grade === 'B') return chalk.bold.cyan(grade);
  if (grade === 'C') return chalk.bold.yellow(grade);
  if (grade === 'D') return chalk.bold.magenta(grade);
  return chalk.bold.red(grade);
}

// ─── Terminal reporter ─────────────────────────────────────────────────────────

export function printCombinedTerminal(report: HealthReport): void {
  const { project, tool, score, grade, tokenMethod } = report;

  console.log('');
  console.log(chalk.bold.white(`  ══════════════════════════════════════════════════`));
  console.log(
    `  ${chalk.bold.white('instrlint')}  ${chalk.gray('—')}  ${chalk.cyan(project)}`,
  );
  console.log(
    `  ${chalk.gray('Tool:')} ${chalk.white(tool)}  ${chalk.gray('·')}  ${chalk.gray(tokenMethod)}`,
  );
  console.log(
    `  ${chalk.gray('Score:')} ${chalk.bold.white(String(score))}/100  ${gradeColour(grade)}`,
  );
  console.log(chalk.bold.white(`  ══════════════════════════════════════════════════`));

  // ─── Budget section ──────────────────────────────────────────────────────────
  const budgetFindings = report.findings.filter((f) => f.category === 'budget');
  printBudgetTerminal(report.budget, budgetFindings);

  // ─── Dead rules section ──────────────────────────────────────────────────────
  const deadRuleFindings = report.findings.filter(
    (f) => f.category === 'dead-rule' || f.category === 'duplicate',
  );
  if (deadRuleFindings.length > 0) {
    printDeadRulesTerminal(deadRuleFindings);
  }

  // ─── Structure section ────────────────────────────────────────────────────────
  const structureFindings = report.findings.filter(
    (f) =>
      f.category === 'contradiction' ||
      f.category === 'stale-ref' ||
      f.category === 'structure',
  );
  if (structureFindings.length > 0) {
    printStructureTerminal(structureFindings);
  }

  // ─── Action plan ──────────────────────────────────────────────────────────────
  if (report.actionPlan.length > 0) {
    console.log('');
    console.log(chalk.bold.white('  ACTION PLAN'));
    console.log(chalk.gray('  ─'.repeat(30)));

    const top = report.actionPlan.slice(0, 10);
    for (let i = 0; i < top.length; i++) {
      const item = top[i]!;
      const icon =
        item.priority === 1
          ? chalk.red('✖')
          : item.priority === 2
            ? chalk.yellow('⚠')
            : chalk.blue('ℹ');
      const desc =
        item.description.length > 80
          ? `${item.description.slice(0, 80)}...`
          : item.description;
      console.log(`  ${i + 1}. ${icon}  ${desc}`);
    }

    if (report.actionPlan.length > 10) {
      console.log(chalk.gray(`  … and ${report.actionPlan.length - 10} more`));
    }
    console.log('');
  }

  console.log(chalk.bold.white(`  ══════════════════════════════════════════════════`));
  if (report.findings.length === 0) {
    console.log(chalk.green('  ✓ Perfect score — no issues found'));
  } else {
    const criticals = report.findings.filter((f) => f.severity === 'critical').length;
    const warnings = report.findings.filter((f) => f.severity === 'warning').length;
    const infos = report.findings.filter((f) => f.severity === 'info').length;
    const parts: string[] = [];
    if (criticals > 0) parts.push(chalk.red(`${criticals} critical`));
    if (warnings > 0) parts.push(chalk.yellow(`${warnings} warning${warnings > 1 ? 's' : ''}`));
    if (infos > 0) parts.push(chalk.blue(`${infos} suggestion${infos > 1 ? 's' : ''}`));
    console.log(`  ${parts.join(chalk.gray(' · '))}`);
  }
  console.log('');
}

// ─── JSON reporter ─────────────────────────────────────────────────────────────

export function reportJson(report: HealthReport): string {
  return JSON.stringify(report, null, 2);
}

// ─── Markdown reporter ─────────────────────────────────────────────────────────

function mdSeverityIcon(f: Finding): string {
  if (f.severity === 'critical') return '🔴';
  if (f.severity === 'warning') return '🟡';
  return 'ℹ️';
}

export function reportMarkdown(report: HealthReport): string {
  const { project, tool, score, grade, findings } = report;
  const criticals = findings.filter((f) => f.severity === 'critical').length;
  const warnings = findings.filter((f) => f.severity === 'warning').length;
  const infos = findings.filter((f) => f.severity === 'info').length;

  const lines: string[] = [
    `# instrlint Health Report — ${project}`,
    '',
    `**Score: ${score}/100 (${grade})** · Tool: \`${tool}\``,
    '',
    '## Summary',
    '',
    '| Severity | Count |',
    '|----------|-------|',
    `| 🔴 Critical | ${criticals} |`,
    `| 🟡 Warning | ${warnings} |`,
    `| ℹ️ Info | ${infos} |`,
    '',
  ];

  // Findings grouped by category
  const categories: Array<{ label: string; filter: (f: Finding) => boolean }> = [
    { label: 'Contradictions', filter: (f) => f.category === 'contradiction' },
    { label: 'Stale References', filter: (f) => f.category === 'stale-ref' },
    { label: 'Dead Rules', filter: (f) => f.category === 'dead-rule' },
    { label: 'Duplicates', filter: (f) => f.category === 'duplicate' },
    { label: 'Budget Issues', filter: (f) => f.category === 'budget' },
    { label: 'Refactoring Opportunities', filter: (f) => f.category === 'structure' },
  ];

  for (const { label, filter } of categories) {
    const group = findings.filter(filter);
    if (group.length === 0) continue;
    lines.push(`## ${label}`, '');
    for (const f of group) {
      const loc = f.line != null ? ` (line ${f.line})` : '';
      lines.push(`- ${mdSeverityIcon(f)} ${f.suggestion}${loc}`);
    }
    lines.push('');
  }

  // Action plan
  if (report.actionPlan.length > 0) {
    lines.push('## Action Plan', '');
    for (let i = 0; i < Math.min(report.actionPlan.length, 10); i++) {
      const item = report.actionPlan[i]!;
      lines.push(`${i + 1}. ${item.description}`);
    }
    lines.push('');
  }

  lines.push('---', '*Generated by [instrlint](https://github.com/jed1978/instrlint)*');
  return lines.join('\n');
}
