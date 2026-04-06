import { removeLines } from './line-remover.js';
import type { Finding } from '../types.js';

/**
 * Removes exact duplicate rule lines (keeps the first occurrence, removes later ones).
 * Only removes lines flagged as `category: 'duplicate'` and `autoFixable: true`.
 * Near-duplicates (autoFixable: false) are left untouched.
 *
 * @returns number of lines removed
 */
export function deduplicateRules(findings: Finding[]): number {
  return removeLines(findings, ['duplicate']);
}
