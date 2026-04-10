import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { t } from "../i18n/index.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InitCiCommandOpts {
  github?: boolean;
  gitlab?: boolean;
  force?: boolean;
  projectRoot?: string;
}

interface InitCiCommandResult {
  exitCode: number;
  errorMessage?: string;
}

// ─── GitHub Actions workflow template ────────────────────────────────────────

function githubWorkflow(): string {
  return `name: instrlint

on:
  push:
    paths:
      - 'CLAUDE.md'
      - '.claude/**'
      - 'AGENTS.md'
      - '.agents/**'
      - '.cursorrules'
      - '.cursor/**'
  pull_request:
    paths:
      - 'CLAUDE.md'
      - '.claude/**'
      - 'AGENTS.md'
      - '.agents/**'
      - '.cursorrules'
      - '.cursor/**'

jobs:
  instrlint:
    name: Lint instruction files
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run instrlint
        run: npx instrlint@latest ci --fail-on warning --format sarif --output instrlint.sarif

      - name: Upload SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: instrlint.sarif
          category: instrlint
`;
}

// ─── GitLab CI snippet template ───────────────────────────────────────────────

function gitlabSnippet(): string {
  return `# Add this to your .gitlab-ci.yml
instrlint:
  image: node:20
  stage: test
  rules:
    - changes:
        - CLAUDE.md
        - .claude/**/*
        - AGENTS.md
        - .agents/**/*
        - .cursorrules
        - .cursor/**/*
  script:
    - npx instrlint@latest ci --fail-on warning --format json
  allow_failure: false
`;
}

// ─── Core logic ───────────────────────────────────────────────────────────────

export function runInitCi(
  opts: InitCiCommandOpts,
  output: { log: typeof console.log; error: typeof console.error } = console,
): InitCiCommandResult {
  const projectRoot = opts.projectRoot ?? process.cwd();

  if (opts.github) {
    const workflowDir = join(projectRoot, ".github", "workflows");
    const workflowPath = join(workflowDir, "instrlint.yml");

    if (existsSync(workflowPath) && !opts.force) {
      output.error(t("initCi.alreadyExists", { path: workflowPath }));
      return { exitCode: 1, errorMessage: "file already exists" };
    }

    mkdirSync(workflowDir, { recursive: true });
    writeFileSync(workflowPath, githubWorkflow(), "utf8");
    output.log(t("initCi.created", { path: workflowPath }));
    return { exitCode: 0 };
  }

  if (opts.gitlab) {
    output.log(gitlabSnippet());
    return { exitCode: 0 };
  }

  output.error("init-ci: specify --github or --gitlab");
  return { exitCode: 1, errorMessage: "no target specified" };
}
