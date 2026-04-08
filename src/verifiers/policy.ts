import type { Finding } from "../types.js";

/**
 * Returns true for findings that benefit from LLM verification — those with
 * high false-positive rates from the deterministic detectors.
 *
 * High-confidence findings are excluded because they use deterministic checks
 * (filesystem existence, exact config field matching) where LLM review adds
 * no value and would waste the user's session tokens.
 */
export function shouldVerify(finding: Finding): boolean {
  // Exact filesystem check — deterministic, skip verification
  if (finding.category === "stale-ref") return false;

  // Math-based budget checks — deterministic, skip
  if (finding.category === "budget") return false;

  // Structure suggestions are informational, not findings to confirm
  if (finding.category === "structure") return true;

  // Config-overlap dead rules use hard-coded patterns — conservative by design,
  // but auto-fixable ones are safe; non-auto-fixable may have false positives
  if (finding.category === "dead-rule") return !finding.autoFixable;

  // Contradictions have high false-positive rate — always verify
  if (finding.category === "contradiction") return true;

  // Near-duplicates (warning) are ambiguous; exact dupes (info + autoFixable)
  // are deterministic and don't need LLM review
  if (finding.category === "duplicate") {
    return finding.severity === "warning" && !finding.autoFixable;
  }

  return false;
}
