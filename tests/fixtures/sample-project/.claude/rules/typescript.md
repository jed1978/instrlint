---
paths:
  - src/**/*.ts
  - src/**/*.tsx
---

# TypeScript Rules

- Prefer `interface` over `type` for object shapes.
- Use `unknown` instead of `any` for values of unknown type.
- Always provide explicit return types for exported functions.
- Use `const` assertions for readonly objects: `as const`.
