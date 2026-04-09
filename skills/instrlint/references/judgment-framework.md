# LLM Verification — Judgment Framework

Reference document for `/instrlint --verify`. The host agent uses this framework when judging candidates.

## --verify Four-Step Protocol

**Step 1** — Emit candidates:

```bash
npx instrlint@latest --emit-candidates instrlint-candidates.json --skip-report --lang <detected>
```

**Step 2** — Read and judge:

Use the Read tool to read `instrlint-candidates.json`. For each candidate, apply the judgment criteria below.

**Step 3** — Write verdicts to `instrlint-verdicts.json`:

```json
{
  "version": 1,
  "verdicts": [
    { "id": "a3f1c9e2b4d6", "verdict": "rejected", "reason": "兩條規則 context 無關" }
  ]
}
```

Each verdict's `id` must exactly match the `id` in candidates.json (12-char hex). `verdict` is `confirmed` / `rejected` / `uncertain`. `reason` ≤ 500 chars.

**Step 4** — Apply verdicts and render report:

```bash
npx instrlint@latest --apply-verdicts instrlint-verdicts.json --format markdown --lang <detected>
```

Present the output markdown as-is to the user.

## candidates.json Format

```json
{
  "version": 1,
  "generatedAt": "2026-04-07T12:00:00.000Z",
  "projectRoot": "/absolute/path/to/project",
  "candidates": [
    {
      "id": "a3f1c9e2b4d6",
      "category": "contradiction",
      "question": "Do rules A and B actually contradict each other in practice?...",
      "context": {
        "type": "contradiction",
        "ruleA": { "file": "CLAUDE.md", "line": 10, "text": "Use exceptions for error handling." },
        "ruleB": { "file": "CLAUDE.md", "line": 20, "text": "Never throw exceptions, use Result<T> instead." }
      },
      "originalFinding": { "severity": "critical", "category": "contradiction", "file": "CLAUDE.md", "line": 20 }
    }
  ]
}
```

## Judgment Criteria

### contradiction

- **confirmed**: A developer following both ruleA and ruleB simultaneously would face a real conflict in some scenario
- **rejected**: The rules address different contexts, or the negation is only superficial (false positive)
- **uncertain**: Semantically ambiguous; cannot judge from available context

### duplicate

- **confirmed**: Both rules say the same thing in different words — removing one loses no information
- **rejected**: Surface similarity but actually covers different details, scope, or exceptions
- **uncertain**: Cannot determine

### structure

- **confirmed**: This rule is genuinely better enforced by a git hook or path-scoped rule file; keeping it in the root instruction file is redundant
- **rejected**: This rule is an architectural decision, general principle, or context requiring human judgment (e.g. "LLM verification must be host-orchestrated" is a design principle, not something a git hook can enforce)
- **uncertain**: Cannot determine without more context

### General rules

- For structure: read `candidate.context.rule.text` and `candidate.context.suggestion` first
- For contradiction / duplicate: read `candidate.context.ruleA.text` / `ruleB.text` first
- Use the Read tool to view surrounding context in the file when needed
- `reason` can be ≤ 20 chars in practice (max 500 chars — instrlint validates)
- Candidates with no verdict don't need to appear in verdicts.json (instrlint leaves them unchanged)
- `rejected` findings are filtered from the final report; `confirmed` and `uncertain` appear with your reason

---

## CLAUDE.md / AGENTS.md Refactoring — 4-Bucket Framework

### Walkthrough Flow

1. **Read** the file, list major sections (heading + line count)
2. **Classify each section** using the 4-bucket framework below; if a section spans multiple buckets, use the primary body and note it in the decision table
3. **Present a decision table** to the user (section name / line count / recommended action / reason)
4. **Ask** the user: "Minimum split (bucket 1 only) / Full split (buckets 1+2+3) / Custom"
5. **Execute the chosen actions**:
   - bucket 1 → extract to rules directory with `paths:` / `globs:` frontmatter
     - Claude Code: `.claude/rules/`
     - Codex: `.agents/rules/`
   - bucket 2 → extract without path-scope frontmatter
   - bucket 3 → replace with a one-line pointer

### 4-Bucket Classification

| Bucket | Condition | Action |
|---|---|---|
| **1. Real savings** | Tied to specific files/modules, most conversations don't need it (< 30% load rate) | Extract + `paths:` / `globs:` frontmatter |
| **2. Extractable, no savings** | Global, loaded in nearly every conversation (> 80% load rate) | Extract to shorten file — total tokens unchanged |
| **3. Delete, not move** | Duplicates source code (e.g. type definitions already in `src/types.ts`) | Replace with a one-line pointer |
| **4. Stay in root file** | Cross-conversation decisions / commands / state | Don't move |

**Load rate heuristic:** Ask yourself "In what fraction of real conversations would this scope be loaded?"
- > 80% → bucket 2 or 4 (path-scoping gives no benefit)
- 30–80% → decide based on maintenance cost
- < 30% → bucket 1 (real savings)

### Examples

| Section | Bucket | Reason |
|---|---|---|
| Module-specific gotchas | 1 — Real savings | Only needed when editing that module; scope to the relevant `src/` path |
| Coding conventions | 2 — Extractable, no savings | Loaded for any .ts file; splitting doesn't change total tokens |
| Key types (type definitions, **identical to source file with no extra commentary**) | 3 — Delete, not move | Duplicate info; keep one line: `see src/types.ts` |
| Architecture decisions | 4 — Stay in root file | Cross-file design principles needed every conversation |

> **Principle:** The purpose of path-scoping is "don't load this in conversations that don't need it." If it would be loaded in almost every conversation anyway, it's bucket 2, not bucket 1.
