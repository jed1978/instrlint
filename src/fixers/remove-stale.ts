import { removeLines } from './line-remover.js';
import type { Finding } from '../types.js';

/**
 * Removes lines that contain references to non-existent files.
 * Only removes lines flagged as `category: 'stale-ref'` and `autoFixable: true`.
 *
 * @returns number of lines removed
 */
export function removeStaleRefs(findings: Finding[]): number {
  return removeLines(findings, ['stale-ref']);
}
