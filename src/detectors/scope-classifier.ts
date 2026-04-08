import type { Finding, ParsedInstructions } from "../types.js";

// ─── Patterns ─────────────────────────────────────────────────────────────────

/** Rule references a specific source directory → suggest a path-scoped rule file */
const PATH_REF_PATTERN = /\b(?:src|tests?|lib|dist)\//i;

/** Rule forbids a git workflow action → suggest a git hook instead */
const HOOK_PATTERN =
  /\b(?:never|don't|do\s+not|forbid)\b(?:\s+\w+){0,3}\s+\b(?:commit|push|merge|rebase|tag|checkout|amend)\b/i;

// ─── Public API ───────────────────────────────────────────────────────────────

export function classifyScope(instructions: ParsedInstructions): Finding[] {
  const findings: Finding[] = [];
  const rootFile = instructions.rootFile;

  for (const line of rootFile.lines) {
    if (line.type !== "rule") continue;

    if (HOOK_PATTERN.test(line.text)) {
      const snippet =
        line.text.length > 60 ? `${line.text.slice(0, 60)}...` : line.text;
      findings.push({
        severity: "info",
        category: "structure",
        file: rootFile.path,
        line: line.lineNumber,
        messageKey: "structure.scopeHook",
        messageParams: { line: String(line.lineNumber), snippet },
        suggestion: `Rule at line ${line.lineNumber} could be a git hook: "${snippet}"`,
        autoFixable: false,
      });
      // Don't also emit path-scoped suggestion for the same line
      continue;
    }

    if (PATH_REF_PATTERN.test(line.text)) {
      const snippet =
        line.text.length > 60 ? `${line.text.slice(0, 60)}...` : line.text;
      findings.push({
        severity: "info",
        category: "structure",
        file: rootFile.path,
        line: line.lineNumber,
        messageKey: "structure.scopePathScoped",
        messageParams: { line: String(line.lineNumber), snippet },
        suggestion: `Rule at line ${line.lineNumber} references a specific path — consider a path-scoped rule file: "${snippet}"`,
        autoFixable: false,
      });
    }
  }

  return findings;
}
