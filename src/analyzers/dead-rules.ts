import { detectConfigOverlaps } from "../detectors/config-overlap.js";
import { detectDuplicates } from "../detectors/duplicate.js";
import type { Finding, ParsedInstructions } from "../types.js";

interface DeadRulesResult {
  findings: Finding[];
}

export function analyzeDeadRules(
  instructions: ParsedInstructions,
  projectRoot: string,
): DeadRulesResult {
  return {
    findings: [
      ...detectConfigOverlaps(instructions, projectRoot),
      ...detectDuplicates(instructions),
    ],
  };
}
