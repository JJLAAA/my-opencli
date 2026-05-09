# Logging Guidelines

> How output and errors are written in this project.

---

## Overview

No logging framework. Two channels only:

| Channel | Use case |
|---------|----------|
| `console.log` | Normal output — pipeline results via `printOutput()` |
| `console.error` | Structured error output from `fail()` / top-level unexpected-error handling |

---

## Rules

- **Never use `console.log` for errors** — always `console.error`
- **Never use `console.error` for data output** — data always goes through `printOutput()`
- **User-facing errors in core CLI paths go through structured error handling** — use `fail()` with a stable code and exit code
- **No debug logging in committed code** — remove any `console.log` debug traces before committing
- **No log levels, no timestamps, no structured log objects** — this is a CLI, not a server

---

## Examples

```js
// User-facing error -> structured JSON on stderr via fail()
fail(`Unknown site: ${site}`, { code: 'unknown_site', exitCode: EXIT_USAGE });

// Data output -> stdout via printOutput()
printOutput(result, format, { adapter, site, command, args });
```
