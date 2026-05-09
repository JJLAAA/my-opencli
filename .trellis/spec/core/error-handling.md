# Error Handling

> How errors are handled in this project.

---

## Overview

Errors are classified into exit codes and always output structured JSON. All error output goes to stderr; successful command output goes to stdout.

---

## Exit Codes

| Code | Name | Constant | When |
|------|------|----------|------|
| 0 | success | — | Command completed |
| 1 | general_error | — | Unexpected failure |
| 2 | usage_error | `EXIT_USAGE` | Bad invocation, unknown option, missing arg, unsupported format |
| 3 | config_error | `EXIT_CONFIG` | Missing/invalid TAP setup |
| 4 | browser_error | `EXIT_BROWSER` | Chrome/CDP unavailable |
| 5 | upstream_error | `EXIT_UPSTREAM` | Network or remote API failure |
| 6 | adapter_contract_error / adapter_load_error | `EXIT_ADAPTER` | Invalid adapter output schema or adapter module cannot load |

---

## `fail()` — Structured Error Exit

```js
// src/cli.js
function fail(message, { code, exitCode, suggestion, retryable, details } = {})
```

- Outputs `{ error: { code, message, suggestion, retryable, details } }` as JSON to stderr.
- Always calls `process.exit(exitCode)`.

### Error code naming

Use `snake_case` identifiers: `unknown_site`, `missing_required_arg`, `unsupported_format`, `adapter_contract_error`, `cdp_unreachable`, `upstream_error`, `browser_error`.

---

## `--format` Detection

`--format` is detected and stripped from argv globally in `runCli()` before any command dispatch. JSON is the default and only supported output format; `--format json` is accepted but optional.

```js
const rawFormat = peekFormat(argv);
```

When `--format` is present with an unsupported value, the CLI still produces a structured JSON error with `code: unsupported_format`.

---

## Error Patterns by Category

### Usage errors (exit 2)

All argument parsing, unknown commands/sites, and unsupported formats. These are non-retryable.

```js
fail(`Unknown site: ${site}`, { code: 'unknown_site', exitCode: EXIT_USAGE });
fail(`Unsupported format: ${fmt}`, {
  code: 'unsupported_format', exitCode: EXIT_USAGE,
  suggestion: 'Use --format json or omit --format. JSON is the only supported output format.',
  details: { format: fmt, supported: ['json'] },
});
```

### Config errors (exit 3)

Setup failures, missing directories, invalid config.

```js
fail(error.message, { code: 'setup_error', exitCode: EXIT_CONFIG });
```

### Browser errors (exit 4)

CDP unreachable, Chrome not found. Include a suggestion to start the browser.

```js
fail(error.message, { code: 'cdp_unreachable', exitCode: EXIT_BROWSER, suggestion: 'Run: tap browser start' });
```

### Upstream errors (exit 5)

Network failures, remote API errors. These are retryable.

```js
fail(error.message, { code: 'upstream_error', exitCode: EXIT_UPSTREAM, retryable: true });
```

### Adapter contract errors (exit 6)

Missing `output.fields`, invalid schema, or adapter load failures. Non-retryable — requires adapter fix.

```js
fail(error.message, { code: 'adapter_contract_error', exitCode: EXIT_ADAPTER });
```

Adapter module import/preflight failures use `adapter_load_error` and must include enough context for an agent to edit the adapter without guessing:

```js
fail(error.message, {
  code: 'adapter_load_error',
  exitCode: EXIT_ADAPTER,
  suggestion: error.suggestion,
  details: {
    site,
    command,
    adapterPath,
    diagnostics: [{ line, column, message, source }],
  },
});
```

Known adapter authoring gotcha: TAP template expressions inside JavaScript backtick strings must escape the dollar sign as `\${{ ... }}`. Otherwise Bun parses `${{ ... }}` as JavaScript template interpolation before TAP can render it. The CLI should preflight this case and return a line-level diagnostic instead of falling through to top-level `internal_error`.

---

## Top-Level Error Handler

`bin/cli.js` wraps `runCli()` in a try/catch for truly unexpected errors (bugs). These always exit 1 with `code: internal_error`.

```js
// bin/cli.js
try {
  await runCli();
} catch (error) {
  console.error(JSON.stringify({ error: { code: 'internal_error', message: error.message, ... } }));
  // Then exit with general_error.
}
```

---

## Pipeline Error Handling

Pipeline errors from `executePipeline` are caught in `runCli()` and classified:

- Errors mentioning CDP/Chrome/browser/WebSocket → exit 4 (browser error)
- All others → exit 5 (upstream error, retryable)

```js
} catch (error) {
  const isBrowserError = /cdp|chrome|browser|devtools|websocket/i.test(error.message);
  fail(error.message, {
    code: isBrowserError ? 'browser_error' : 'upstream_error',
    exitCode: isBrowserError ? EXIT_BROWSER : EXIT_UPSTREAM,
    retryable: !isBrowserError,
  });
} finally {
  session?.close();
  if (targetId) await closeTab(base, targetId);
}
```

---

## Common Mistakes

- **Don't use `process.exit()` directly** — use `fail()` so JSON mode is respected.
- **Don't skip the `code` field** in `fail()` — every call site should specify a stable error code.
- **Don't let adapter import/build failures reach `bin/cli.js`** — classify them as `adapter_load_error` with `adapterPath` and diagnostics.
- **Don't catch errors in executor/cdp** unless you can recover. Let them propagate to the catch block in `runCli()`.
- **Don't throw from `closeTab`** — it's a best-effort cleanup (fire-and-forget).
- **Don't add fallback data** when a step genuinely failed. Fail loudly.
