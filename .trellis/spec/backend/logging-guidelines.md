# Logging Guidelines

> How output and errors are written in this project.

---

## Overview

No logging framework. Two channels only:

| Channel | Use case |
|---------|----------|
| `console.log` | Normal output — pipeline results via `printOutput()` |
| `console.error` | User-facing errors before `process.exit(1)` |

---

## Rules

- **Never use `console.log` for errors** — always `console.error`
- **Never use `console.error` for data output** — data always goes through `printOutput()`
- **No debug logging in committed code** — remove any `console.log` debug traces before committing
- **No log levels, no timestamps, no structured log objects** — this is a CLI, not a server

---

## Examples

```js
// User error → stderr + exit
console.error(`Adapter not found: ${adapterPath}`);
process.exit(1);

// Data output → stdout via printOutput
printOutput(result, format, adapter.columns);
```
