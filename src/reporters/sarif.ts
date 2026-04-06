import type { Finding, HealthReport } from "../types.js";

// ─── SARIF v2.1.0 types ────────────────────────────────────────────────────

interface SarifArtifactLocation {
  uri: string;
  uriBaseId?: string;
}

interface SarifRegion {
  startLine: number;
}

interface SarifPhysicalLocation {
  artifactLocation: SarifArtifactLocation;
  region?: SarifRegion;
}

interface SarifLocation {
  physicalLocation: SarifPhysicalLocation;
}

interface SarifMessage {
  text: string;
}

interface SarifResult {
  ruleId: string;
  level: "error" | "warning" | "note";
  message: SarifMessage;
  locations: SarifLocation[];
}

interface SarifRule {
  id: string;
  name: string;
  shortDescription: SarifMessage;
}

interface SarifDriver {
  name: string;
  version: string;
  informationUri: string;
  rules: SarifRule[];
}

interface SarifTool {
  driver: SarifDriver;
}

interface SarifRun {
  tool: SarifTool;
  results: SarifResult[];
}

interface SarifLog {
  $schema: string;
  version: "2.1.0";
  runs: SarifRun[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function severityToLevel(
  severity: Finding["severity"],
): "error" | "warning" | "note" {
  if (severity === "critical") return "error";
  if (severity === "warning") return "warning";
  return "note";
}

function findingToRuleId(f: Finding): string {
  return `instrlint/${f.category}/${f.messageKey.replace(/\./g, "/")}`;
}

function buildRules(findings: Finding[]): SarifRule[] {
  const seen = new Set<string>();
  const rules: SarifRule[] = [];
  for (const f of findings) {
    const id = findingToRuleId(f);
    if (seen.has(id)) continue;
    seen.add(id);
    rules.push({
      id,
      name: f.messageKey,
      shortDescription: { text: `${f.category}: ${f.messageKey}` },
    });
  }
  return rules;
}

// ─── Public API ────────────────────────────────────────────────────────────

export function reportSarif(report: HealthReport): string {
  const rules = buildRules(report.findings);

  const results: SarifResult[] = report.findings.map((f) => ({
    ruleId: findingToRuleId(f),
    level: severityToLevel(f.severity),
    message: { text: f.suggestion },
    locations: [
      {
        physicalLocation: {
          artifactLocation: {
            uri: f.file.replace(/\\/g, "/"),
            uriBaseId: "%SRCROOT%",
          },
          ...(f.line != null ? { region: { startLine: f.line } } : {}),
        },
      },
    ],
  }));

  const log: SarifLog = {
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "instrlint",
            version: "0.1.0",
            informationUri: "https://github.com/jed1978/instrlint",
            rules,
          },
        },
        results,
      },
    ],
  };

  return JSON.stringify(log, null, 2);
}
