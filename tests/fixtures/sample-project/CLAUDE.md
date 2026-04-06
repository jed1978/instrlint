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
Always sort imports: external before internal. Never mix external and internal import groups.

## Commits

<!-- instrlint-test: duplicate (exact duplicate of line ~180) -->
- Use `type: description` format for all commit messages. Keep subject line under 72 characters.

## Testing

<!-- instrlint-test: duplicate (semantic duplicate of line ~200 — different wording, same intent) -->
Unit tests must be written for all public functions. Tests must cover at least one success path and one failure path.

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
- Use `type: description` format for all commit messages. Keep subject line under 72 characters.

## Testing (continued)

<!-- instrlint-test: duplicate (semantic duplicate of line ~45 — different wording, same intent) -->
Unit tests must be written for all public functions. Each test must cover at least one success path and one error path.

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

## Observability

All API requests must be traced with a correlation ID in the request headers.
Use structured logging with the following fields: timestamp, level, correlationId, message, data.
Metrics must be emitted for every background job: start time, end time, success/failure.

## Dependency Management

<!-- instrlint-test: structure (5th rule referencing src/components/ — triggers path-scoped suggestion) -->
Before updating any dependency used by src/components/, run the full component test suite.
Pin all production dependencies to exact versions using pnpm's lockfile.
Review changelogs for breaking changes before upgrading major versions.
- Never upgrade multiple major dependencies in the same PR.
- Always run `pnpm audit` after updating dependencies.

## Git Hygiene

- Never merge a branch with failing tests.
- Squash WIP commits before opening a PR.
- Use `git rebase --interactive` to clean up history, not `git merge`.
- Delete feature branches after merging.
- Branch naming: `<type>/<short-description>` (e.g. `feat/add-budget-analyzer`).

## Release Process

<!-- instrlint-test: structure (4th deploy rule — reinforces skill suggestion) -->
To cut a release:
1. Update CHANGELOG.md with all changes since the last release.
2. Bump the version in package.json following SemVer.
3. Create a release PR and get it reviewed.
4. After merge, tag the commit: `git tag v<version>`.
5. The Jenkins pipeline will build and publish automatically. <!-- instrlint-test: stale-ref (Jenkins reference again) -->

## Code Organization

Files over 400 lines must be split into smaller modules.
- Never put business logic inside UI components — extract to hooks or services.
- Barrel exports (`index.ts`) are allowed only at directory boundaries.
- Avoid circular imports — use the dependency graph to check.

## Environment Configuration

All environment variables must be documented in `.env.example`.
- Never read `process.env` directly in business logic — use a typed config module.
- Validate all required environment variables at startup with a schema check.

## Internationalization

All user-facing strings must go through the `t()` helper.
- Never hardcode display text in components under src/components/.
- Date and number formatting in src/components/ must use `Intl.*` APIs.
- RTL layout must be tested for all views in src/components/ that contain text.
