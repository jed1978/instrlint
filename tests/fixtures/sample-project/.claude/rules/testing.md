---
globs:
  - "**/*.test.ts"
  - "**/*.spec.ts"
---

# Testing Rules

- Use `describe` blocks to group related tests.
- Test names must be descriptive: "should <action> when <condition>".
- Always clean up mocks in `afterEach`.
- Target 80% branch coverage minimum.
