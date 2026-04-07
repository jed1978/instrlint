import type { Finding, FindingCategory } from "../types.js";

// ─── Candidate (instrlint → host) ─────────────────────────────────────────────

export interface RuleRef {
  file: string;
  line: number;
  text: string;
}

export interface ContradictionContext {
  type: "contradiction";
  ruleA: RuleRef;
  ruleB: RuleRef;
}

export interface DuplicateContext {
  type: "duplicate";
  ruleA: RuleRef;
  ruleB: RuleRef;
}

export type CandidateContext = ContradictionContext | DuplicateContext;

export interface Candidate {
  /** Stable content-based hash for matching verdicts back to findings. */
  id: string;
  category: FindingCategory;
  /** Question in the user's chosen locale, ready to present to the host LLM. */
  question: string;
  context: CandidateContext;
  /** Full original finding for reference. */
  originalFinding: Finding;
}

export interface CandidatesFile {
  version: 1;
  generatedAt: string;
  projectRoot: string;
  candidates: Candidate[];
}

// ─── Verdict (host → instrlint) ───────────────────────────────────────────────

export type VerifyVerdict = "confirmed" | "rejected" | "uncertain";

export interface Verdict {
  /** Matches Candidate.id */
  id: string;
  verdict: VerifyVerdict;
  /** One sentence shown in the report. */
  reason: string;
}

export interface VerdictsFile {
  version: 1;
  verdicts: Verdict[];
}
