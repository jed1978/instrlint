import { describe, it, expect } from "vitest";
import {
  applyVerdicts,
  loadVerdictsFile,
} from "../../src/verifiers/verdicts.js";
import { hashFinding } from "../../src/verifiers/candidates.js";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { Finding } from "../../src/types.js";
import type { VerdictsFile } from "../../src/verifiers/schema.js";

function makeFinding(id: string): Finding {
  return {
    severity: "critical",
    category: "contradiction",
    file: "CLAUDE.md",
    line: Number(id),
    messageKey: `key.${id}`,
    suggestion: "",
    autoFixable: false,
  };
}

const findingA = makeFinding("10");
const findingB = makeFinding("20");
const findingC = makeFinding("30");

describe("applyVerdicts: filtering", () => {
  it("removes rejected findings", () => {
    const verdicts: VerdictsFile = {
      version: 1,
      verdicts: [
        {
          id: hashFinding(findingA),
          verdict: "rejected",
          reason: "false positive",
        },
      ],
    };
    const { findings } = applyVerdicts([findingA, findingB], verdicts);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.line).toBe(20);
  });

  it("attaches verification to confirmed findings", () => {
    const verdicts: VerdictsFile = {
      version: 1,
      verdicts: [
        {
          id: hashFinding(findingA),
          verdict: "confirmed",
          reason: "real contradiction",
        },
      ],
    };
    const { findings } = applyVerdicts([findingA], verdicts);
    expect(findings[0]!.verification).toEqual({
      verdict: "confirmed",
      reason: "real contradiction",
    });
  });

  it("attaches verification to uncertain findings (does not filter)", () => {
    const verdicts: VerdictsFile = {
      version: 1,
      verdicts: [
        {
          id: hashFinding(findingA),
          verdict: "uncertain",
          reason: "needs context",
        },
      ],
    };
    const { findings } = applyVerdicts([findingA], verdicts);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.verification?.verdict).toBe("uncertain");
  });

  it("passes through findings with no matching verdict", () => {
    const verdicts: VerdictsFile = { version: 1, verdicts: [] };
    const { findings } = applyVerdicts([findingA, findingB], verdicts);
    expect(findings).toHaveLength(2);
    expect(findings[0]!.verification).toBeUndefined();
  });

  it("ignores unknown IDs in verdicts (forward-compatible)", () => {
    const verdicts: VerdictsFile = {
      version: 1,
      verdicts: [{ id: "deadbeef0000", verdict: "rejected", reason: "old" }],
    };
    const { findings } = applyVerdicts([findingA, findingB], verdicts);
    expect(findings).toHaveLength(2);
  });

  it("does not mutate original findings array", () => {
    const original = [findingA, findingB, findingC];
    const verdicts: VerdictsFile = {
      version: 1,
      verdicts: [
        { id: hashFinding(findingB), verdict: "rejected", reason: "fp" },
      ],
    };
    applyVerdicts(original, verdicts);
    expect(original).toHaveLength(3);
  });

  it("returns rejectedCount equal to number of filtered findings", () => {
    const verdicts: VerdictsFile = {
      version: 1,
      verdicts: [
        { id: hashFinding(findingA), verdict: "rejected", reason: "fp" },
        { id: hashFinding(findingB), verdict: "rejected", reason: "fp" },
      ],
    };
    const { findings, rejectedCount } = applyVerdicts(
      [findingA, findingB, findingC],
      verdicts,
    );
    expect(findings).toHaveLength(1);
    expect(rejectedCount).toBe(2);
  });

  it("returns rejectedCount 0 when nothing is rejected", () => {
    const verdicts: VerdictsFile = { version: 1, verdicts: [] };
    const { rejectedCount } = applyVerdicts([findingA, findingB], verdicts);
    expect(rejectedCount).toBe(0);
  });
});

// ─── loadVerdictsFile validation (H2 + M1) ───────────────────────────────────

function writeTmp(name: string, content: string): string {
  const dir = join(tmpdir(), "instrlint-test");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

describe("loadVerdictsFile: valid input", () => {
  it("parses a well-formed verdicts file", () => {
    const path = writeTmp(
      "valid.json",
      JSON.stringify({
        version: 1,
        verdicts: [
          { id: "abc123", verdict: "confirmed", reason: "real contradiction" },
        ],
      }),
    );
    const result = loadVerdictsFile(path);
    expect(result.verdicts).toHaveLength(1);
    expect(result.verdicts[0]!.verdict).toBe("confirmed");
  });
});

describe("loadVerdictsFile: validation errors (M1)", () => {
  it("throws if file does not exist", () => {
    expect(() => loadVerdictsFile("/nonexistent/verdicts.json")).toThrow(
      /Cannot read verdicts file/,
    );
  });

  it("throws if file is not valid JSON", () => {
    const path = writeTmp("bad.json", "not json {");
    expect(() => loadVerdictsFile(path)).toThrow(/not valid JSON/);
  });

  it("throws if version is not 1", () => {
    const path = writeTmp(
      "v2.json",
      JSON.stringify({ version: 2, verdicts: [] }),
    );
    expect(() => loadVerdictsFile(path)).toThrow(/unexpected format/);
  });

  it("throws if verdicts is not an array", () => {
    const path = writeTmp(
      "noverdicts.json",
      JSON.stringify({ version: 1, verdicts: "bad" }),
    );
    expect(() => loadVerdictsFile(path)).toThrow(/unexpected format/);
  });

  it("throws if verdict is missing id", () => {
    const path = writeTmp(
      "noid.json",
      JSON.stringify({
        version: 1,
        verdicts: [{ verdict: "confirmed", reason: "ok" }],
      }),
    );
    expect(() => loadVerdictsFile(path)).toThrow(/missing string "id"/);
  });

  it("throws on invalid verdict value", () => {
    const path = writeTmp(
      "badverdict.json",
      JSON.stringify({
        version: 1,
        verdicts: [{ id: "x", verdict: "maybe", reason: "ok" }],
      }),
    );
    expect(() => loadVerdictsFile(path)).toThrow(/invalid verdict/);
  });

  it("throws if reason is missing", () => {
    const path = writeTmp(
      "noreason.json",
      JSON.stringify({
        version: 1,
        verdicts: [{ id: "x", verdict: "confirmed" }],
      }),
    );
    expect(() => loadVerdictsFile(path)).toThrow(/missing string "reason"/);
  });
});

describe("loadVerdictsFile: reason length limit (H2)", () => {
  it("throws if reason exceeds 500 characters", () => {
    const path = writeTmp(
      "longreason.json",
      JSON.stringify({
        version: 1,
        verdicts: [{ id: "x", verdict: "confirmed", reason: "a".repeat(501) }],
      }),
    );
    expect(() => loadVerdictsFile(path)).toThrow(/reason exceeds 500/);
  });

  it("accepts reason of exactly 500 characters", () => {
    const path = writeTmp(
      "maxreason.json",
      JSON.stringify({
        version: 1,
        verdicts: [{ id: "x", verdict: "confirmed", reason: "a".repeat(500) }],
      }),
    );
    expect(() => loadVerdictsFile(path)).not.toThrow();
  });
});
