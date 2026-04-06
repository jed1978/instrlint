import { removeLines } from './line-remover.js';
import type { Finding } from '../types.js';

/**
 * Removes rules that are provably redundant — already enforced by project config.
 * Only removes lines flagged as `category: 'dead-rule'` and `autoFixable: true`.
 *
 * @returns number of lines removed
 */
export function removeDeadRules(findings: Finding[]): number {
  return removeLines(findings, ['dead-rule']);
}
