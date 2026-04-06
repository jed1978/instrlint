# Sample Project

This is a sample project used as a test fixture for instrlint.
It contains deliberately embedded issues for each analyzer category.

## Tech Stack

- Runtime: Node.js >= 18
- Language: TypeScript
- Test framework: Vitest
- Package manager: pnpm

## TypeScript

<!-- instrlint-test: dead-rule (tsconfig.json already sets strict: true) -->
Always use TypeScript strict mode. Enable all strict checks to catch type errors early.

## Code Formatting

<!-- instrlint-test: dead-rule (.editorconfig and .prettierrc already set indent_size=2 / tabWidth=2) -->
Use 2-space indentation for all files. Never use tabs.

<!-- instrlint-test: dead-rule (.prettierrc semi: true) -->
Always use semicolons at the end of statements.

<!-- instrlint-test: dead-rule (.prettierrc singleQuote: true) -->
Use single quotes for strings. Only use double quotes when the string itself contains a single quote.

## Imports

<!-- instrlint-test: dead-rule (.eslintrc.json uses eslint-plugin-import with order rule) -->
Sort imports by external → internal. Put all external library imports before local imports.

## Commits

<!-- instrlint-test: duplicate (exact duplicate of line ~180) -->
Use conventional commit format for all commits. Format: `<type>: <description>`.

## Testing

<!-- instrlint-test: duplicate (semantic duplicate of line ~200 — different wording, same intent) -->
Every public function must have at least one unit test. Tests must be co-located with the source file or placed in a parallel tests/ directory.

## Error Handling

<!-- instrlint-test: contradiction (contradicts line ~150 which says use Result<T>) -->
Use exceptions for error handling. Throw errors with descriptive messages at the point of failure. Always catch exceptions at the appropriate boundary.

## Components

When working on the src/components/ directory, always follow these rules:
- Each component must be a single-responsibility module.
- See src/components/Button.tsx for the canonical button example.
- See src/legacy/OldService.ts for the old pattern to avoid. <!-- instrlint-test: stale-ref (src/legacy/OldService.ts does not exist) -->

When modifying any file in src/components/, run the component tests before submitting.
The src/components/ folder follows atomic design principles.
If you add a new component to src/components/, update the barrel export in src/components/index.ts.
For styling in src/components/, use CSS Modules co-located with the component file.

## Architecture

The project uses a layered architecture:

1. Presentation layer — src/components/
2. Business logic layer — src/services/
3. Data access layer — src/repositories/

All new modules should follow the established patterns in src/components/.

## Deployment

<!-- instrlint-test: structure (3 deploy steps → should become a skill) -->
To deploy to staging:
1. Run `pnpm build` to produce the production bundle.
2. Push to the `staging` branch to trigger the CI pipeline.
3. Monitor the deployment via the Jenkins pipeline dashboard. <!-- instrlint-test: stale-ref (no Jenkinsfile exists) -->

To deploy to production:
1. Merge the staging branch into `main`.
2. Tag the release with `git tag vX.Y.Z`.
3. The Jenkins pipeline will automatically build and publish the Docker image.

## Security

Never commit API keys or secrets to the repository.
Use environment variables for all sensitive configuration.
Run `pnpm audit` before each release.

## Database

All database queries must use parameterized statements to prevent SQL injection.
Schema migrations go in db/migrations/ and must be reviewed by the DBA.

## API Design

RESTful endpoints must follow the naming convention: `/api/v1/<resource>/<id>`.
All responses must use the standard envelope format: `{ success, data, error }`.

## Logging

Use structured logging with JSON format in production.
Never log PII (personally identifiable information).
Log levels: error, warn, info, debug.

## Result Pattern

<!-- instrlint-test: contradiction (contradicts line ~60 which says use exceptions) -->
Use Result<T> pattern, never throw exceptions. All functions that can fail must return Result<T, E>. This enables explicit error handling at every call site.

## Performance

Memoize expensive computations when called repeatedly with the same inputs.
Profile before optimizing — never guess at bottlenecks.
Target: p99 latency < 200ms for all API endpoints.

## Documentation

All exported functions must have JSDoc comments.
Keep the README up to date with every public API change.

## Code Review

Every PR must be reviewed by at least one other engineer.
Address all CRITICAL and HIGH severity findings before merging.

## Commits (continued)

<!-- instrlint-test: duplicate (exact duplicate of line ~30) -->
Use conventional commit format for all commits. Format: `<type>: <description>`.

## Testing (continued)

<!-- instrlint-test: duplicate (semantic duplicate of line ~45 — different wording, same intent) -->
Unit tests are mandatory for all public APIs. Each test suite should cover at least one happy path and one error path. Place tests in tests/ mirroring the src/ structure.

## Miscellaneous

Keep PRs small and focused. Large PRs are harder to review.
Prefer composition over inheritance.
Avoid premature abstraction — wait until you see the pattern three times.

## Accessibility

All UI components in src/components/ must meet WCAG 2.1 AA standards.
Always test interactive elements in src/components/ with a screen reader.
Provide alt text for all images rendered by components in src/components/.

## State Management

Use React Query for server state, Zustand for client state.
Never store derived state — compute it on the fly.
Document state shape changes in the changelog.
