import { existsSync } from 'fs';
import { join } from 'path';
import type { Finding, InstructionFile, ParsedInstructions, ParsedLine } from '../types.js';

// ─── Helpers ───────────────────────────────────────────────────────────────────

interface AnnotatedLine {
  line: ParsedLine;
  file: string;
}

function collectLines(instructions: ParsedInstructions): AnnotatedLine[] {
  const sources: InstructionFile[] = [
    instructions.rootFile,
    ...instructions.subFiles,
    ...instructions.rules,
  ];

  const result: AnnotatedLine[] = [];
  for (const file of sources) {
    for (const line of file.lines) {
      if (line.type === 'blank' || line.type === 'code') continue;
      if (line.referencedPaths.length === 0) continue;
      result.push({ line, file: file.path });
    }
  }
  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function detectStaleRefs(
  instructions: ParsedInstructions,
  projectRoot: string,
): Finding[] {
  const findings: Finding[] = [];

  for (const { line, file } of collectLines(instructions)) {
    for (const refPath of line.referencedPaths) {
      // Skip directory refs (trailing slash) and glob patterns
      if (refPath.endsWith('/') || refPath.includes('*')) continue;

      const absolutePath = join(projectRoot, refPath);
      if (!existsSync(absolutePath)) {
        findings.push({
          severity: 'warning',
          category: 'stale-ref',
          file,
          line: line.lineNumber,
          messageKey: 'structure.staleRef',
          messageParams: { path: refPath },
          suggestion: `Stale reference: "${refPath}" does not exist.`,
          autoFixable: true,
        });
      }
    }
  }

  return findings;
}
