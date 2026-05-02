# Error Handling

> How errors are handled in this project.

---

## Overview

Errors are classified into exit codes and output structured JSON when `--format json` is set. All error output goes to stderr; successful output goes to stdout.

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
| 6 | adapter_contract_error | `EXIT_ADAPTER` | Invalid adapter output schema |

---

## `fail()` — Structured Error Exit

```js
// src/cli.js
function fail(message, { code, exitCode, suggestion, retryable, details } = {})
```

- When `_jsonMode` is true: outputs `{ error: { code, message, suggestion, retryable, details } }` as JSON to stderr.
- When `_jsonMode` is false: outputs plain `message` to stderr.
- Always calls `process.exit(exitCode)`.

### Error code naming

Use `snake_case` identifiers: `unknown_site`, `missing_required_arg`, `unsupported_format`, `adapter_contract_error`, `cdp_unreachable`, `upstream_error`, `browser_error`.

---

## `--format` Detection

`--format` is detected and stripped from argv globally in `runCli()` before any command dispatch. This ensures that even early errors (unknown site, unsupported format) respect JSON mode:

```js
const rawFormat = peekFormat(argv);
_jsonMode = rawFormat !== null;
```

When `--format` is present with any value, `_jsonMode` is set to `true` *before* validation. This means `--format yaml` still produces a structured JSON error (with `code: unsupported_format`) rather than plain text.

---

## Error Patterns by Category

### Usage errors (exit 2)

All argument parsing, unknown commands/sites, and unsupported formats. These are non-retryable.

```js
fail(`Unknown site: ${site}`, { code: 'unknown_site', exitCode: EXIT_USAGE });
fail(`Unsupported format: ${fmt}`, {
  code: 'unsupported_format', exitCode: EXIT_USAGE,
  suggestion: 'Use --format json or omit --format for human-readable text.',
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

Missing `output.fields`, invalid schema. Non-retryable — requires adapter fix.

```js
fail(error.message, { code: 'adapter_contract_error', exitCode: EXIT_ADAPTER });
```

---

## Top-Level Error Handler

`bin/cli.js` wraps `runCli()` in a try/catch for truly unexpected errors (bugs). These always exit 1 with `code: internal_error` in JSON mode.

```js
// bin/cli.js
try {
  await runCli();
} catch (error) {
  if (isJsonMode()) {
    console.error(JSON.stringify({ error: { code: 'internal_error', message: error.message, ... } }));
  } else {
    console.error(error.message || error);
  }
  process.exit(1);
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
- **Don't catch errors in executor/cdp** unless you can recover. Let them propagate to the catch block in `runCli()`.
- **Don't throw from `closeTab`** — it's a best-effort cleanup (fire-and-forget).
- **Don't add fallback data** when a step genuinely failed. Fail loudly.
