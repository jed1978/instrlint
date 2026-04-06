import { detectContradictions } from '../detectors/contradiction.js';
import { detectStaleRefs } from '../detectors/stale-refs.js';
import { classifyScope } from '../detectors/scope-classifier.js';
import type { Finding, ParsedInstructions } from '../types.js';

export interface StructureResult {
  findings: Finding[];
}

export function analyzeStructure(
  instructions: ParsedInstructions,
  projectRoot: string,
): StructureResult {
  return {
    findings: [
      ...detectContradictions(instructions),
      ...detectStaleRefs(instructions, projectRoot),
      ...classifyScope(instructions),
    ],
  };
}
