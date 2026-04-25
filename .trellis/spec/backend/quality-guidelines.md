# Quality Guidelines

> Code quality standards for this project.

---

## Overview

TAP is a small, focused CLI tool. The quality bar is: readable, minimal, correct. No frameworks, no abstractions beyond what's needed.

---

## Required Patterns

- **Pure ESM** — all files use `import`/`export`, no `require()`
- **Single responsibility per file** — each `src/` module does one thing
- **Default export for adapters** — adapters always use `export default { args, columns, pipeline }`
- **Named exports for core modules** — `src/*.js` use named exports
- **Shebang on entry point** — `bin/cli.js` must start with `#!/usr/bin/env bun`

---

## Forbidden Patterns

- **No logic in `bin/cli.js`** — orchestration only; business logic goes in `src/`
- **No `require()` / CommonJS** — this is a pure ESM project
- **No external dependencies beyond `ws`** — the only allowed npm dependency is `ws` for WebSocket
- **No TypeScript** — plain `.js` files only
- **No test framework** — manual testing against live Chrome; no unit test suite currently

---

## Build

```bash
bun build --compile bin/cli.js --outfile tap
```

Produces `tap` — a standalone Bun single-file executable. The binary is committed to the repo.

---

## Code Review Checklist

- [ ] No new npm dependencies introduced
- [ ] Adapter follows the `{ args, columns, pipeline }` shape
- [ ] Pipeline steps use only supported ops: `fetch`, `navigate`, `evaluate`, `intercept`, `select`, `filter`, `map`, `sort`, `limit`
- [ ] Template expressions use `${{ expr }}` syntax
- [ ] Cleanup runs in `finally` (browser tab is closed)
- [ ] Errors propagate correctly (no silent swallowing except `closeTab`)
