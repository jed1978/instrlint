import { readFileSync, writeFileSync } from 'fs';
import type { Finding, FindingCategory } from '../types.js';

/**
 * Removes lines from files based on findings of the specified categories.
 * Only removes lines where `autoFixable === true` and `line` is set.
 * Processes removals from bottom to top within each file to avoid line-offset shifts.
 *
 * @returns total number of lines removed across all files
 */
export function removeLines(findings: Finding[], categories: FindingCategory[]): number {
  const catSet = new Set<FindingCategory>(categories);
  const fixable = findings.filter(
    (f) => catSet.has(f.category) && f.autoFixable && f.line != null,
  );

  // Group by file path
  const byFile = new Map<string, number[]>();
  for (const f of fixable) {
    const arr = byFile.get(f.file) ?? [];
    arr.push(f.line!);
    byFile.set(f.file, arr);
  }

  let totalFixed = 0;

  for (const [filePath, lineNumbers] of byFile) {
    // Deduplicate and sort descending so we remove from the bottom up
    const uniqueSorted = [...new Set(lineNumbers)].sort((a, b) => b - a);

    const content = readFileSync(filePath, 'utf8');
    // Preserve trailing newline behaviour: if file ends with \n, the last element after split is ''
    const lines = content.split('\n');

    for (const lineNum of uniqueSorted) {
      const idx = lineNum - 1; // convert 1-based to 0-indexed
      if (idx >= 0 && idx < lines.length) {
        lines.splice(idx, 1);
      }
    }

    writeFileSync(filePath, lines.join('\n'));
    totalFixed += uniqueSorted.length;
  }

  return totalFixed;
}
