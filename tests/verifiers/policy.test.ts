import { describe, it, expect } from "vitest";
import { shouldVerify } from "../../src/verifiers/policy.js";
import type { Finding } from "../../src/types.js";

function makeFinding(
  overrides: Partial<Finding> & Pick<Finding, "category" | "severity">,
): Finding {
  return {
    file: "CLAUDE.md",
    messageKey: "test.key",
    suggestion: "",
    autoFixable: false,
    ...overrides,
  };
}

describe("shouldVerify: always verify", () => {
  it("contradiction → true", () => {
    expect(
      shouldVerify(makeFinding({ category: "contradiction", severity: "critical" })),
    ).toBe(true);
  });

  it("near-duplicate warning (not auto-fixable) → true", () => {
    expect(
      shouldVerify(
        makeFinding({ category: "duplicate", severity: "warning", autoFixable: false }),
      ),
    ).toBe(true);
  });
});

describe("shouldVerify: never verify", () => {
  it("stale-ref → false", () => {
    expect(
      shouldVerify(makeFinding({ category: "stale-ref", severity: "warning" })),
    ).toBe(false);
  });

  it("budget → false", () => {
    expect(
      shouldVerify(makeFinding({ category: "budget", severity: "warning" })),
    ).toBe(false);
  });

  it("structure → false", () => {
    expect(
      shouldVerify(makeFinding({ category: "structure", severity: "info" })),
    ).toBe(false);
  });

  it("exact duplicate (autoFixable) → false", () => {
    expect(
      shouldVerify(
        makeFinding({ category: "duplicate", severity: "warning", autoFixable: true }),
      ),
    ).toBe(false);
  });

  it("near-duplicate info → false", () => {
    expect(
      shouldVerify(
        makeFinding({ category: "duplicate", severity: "info", autoFixable: false }),
      ),
    ).toBe(false);
  });

  it("auto-fixable dead-rule → false", () => {
    expect(
      shouldVerify(
        makeFinding({ category: "dead-rule", severity: "warning", autoFixable: true }),
      ),
    ).toBe(false);
  });
});

describe("shouldVerify: non-auto-fixable dead-rule", () => {
  it("non-auto-fixable dead-rule → true", () => {
    expect(
      shouldVerify(
        makeFinding({ category: "dead-rule", severity: "warning", autoFixable: false }),
      ),
    ).toBe(true);
  });
});
