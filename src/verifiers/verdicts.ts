import { readFileSync } from "fs";
import type { Finding } from "../types.js";
import type { VerdictsFile } from "./schema.js";
import { hashFinding } from "./candidates.js";

/**
 * Reads verdicts.json written by the host agent and merges verdicts back into
 * the findings array.
 *
 * - `rejected` findings are removed entirely (they were false positives).
 * - `confirmed` and `uncertain` findings get a `verification` field attached.
 * - Findings with no matching verdict are returned unchanged.
 * - Unknown IDs in verdicts are silently ignored (forward-compatible).
 */
export function applyVerdicts(
  findings: Finding[],
  verdictsFile: VerdictsFile,
): Finding[] {
  const verdictMap = new Map(verdictsFile.verdicts.map((v) => [v.id, v]));

  return findings
    .map((f): Finding => {
      const verdict = verdictMap.get(hashFinding(f));
      if (!verdict) return f;
      return {
        ...f,
        verification: { verdict: verdict.verdict, reason: verdict.reason },
      };
    })
    .filter((f) => f.verification?.verdict !== "rejected");
}

/**
 * Loads and parses a verdicts.json file from disk.
 * Throws with a descriptive message if the file is missing or malformed.
 */
export function loadVerdictsFile(filePath: string): VerdictsFile {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    throw new Error(
      `Cannot read verdicts file: ${filePath}\nRun instrlint --emit-candidates first, then ask the host LLM to write verdicts.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`verdicts.json is not valid JSON: ${filePath}`);
  }

  const obj = parsed as Record<string, unknown>;

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    obj["version"] !== 1 ||
    !Array.isArray(obj["verdicts"])
  ) {
    throw new Error(
      `verdicts.json has unexpected format (expected {version:1, verdicts:[...]}): ${filePath}`,
    );
  }

  const VALID_VERDICTS = new Set(["confirmed", "rejected", "uncertain"]);
  const MAX_REASON_LENGTH = 500;

  for (const v of obj["verdicts"] as unknown[]) {
    if (typeof v !== "object" || v === null) {
      throw new Error(`verdicts.json: each verdict must be an object`);
    }
    const item = v as Record<string, unknown>;
    if (typeof item["id"] !== "string" || item["id"].length === 0) {
      throw new Error(`verdicts.json: verdict missing string "id"`);
    }
    if (!VALID_VERDICTS.has(item["verdict"] as string)) {
      throw new Error(
        `verdicts.json: invalid verdict "${item["verdict"]}" for id "${item["id"]}" (must be confirmed|rejected|uncertain)`,
      );
    }
    if (typeof item["reason"] !== "string") {
      throw new Error(
        `verdicts.json: verdict "${item["id"]}" missing string "reason"`,
      );
    }
    if ((item["reason"] as string).length > MAX_REASON_LENGTH) {
      throw new Error(
        `verdicts.json: verdict "${item["id"]}" reason exceeds ${MAX_REASON_LENGTH} characters`,
      );
    }
  }

  return parsed as VerdictsFile;
}
