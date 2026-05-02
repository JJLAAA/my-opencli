# Agent-Friendly CLI Phase 1

## Goal

Make TAP's CLI failure and local-diagnostics paths reliable for AI agents without changing adapter execution semantics.

Phase 1 focuses on the agent self-recovery loop:

1. A command fails.
2. The agent can parse the failure deterministically.
3. The agent can distinguish usage, setup, browser, upstream, and adapter-contract failures.
4. The agent can run local diagnostic commands and receive machine-readable status.

## Background

TAP's data commands already have a strong agent-friendly foundation:

- Data commands default to JSON.
- JSON output is wrapped as `{ meta, schema, items }`.
- Adapters must declare `output.fields` for JSON output.

The main gap is that failures and management commands are still optimized for human text:

- `fail()` prints plain text and exits with `1`.
- `doctor`, `browser`, and `setup` return human text only.
- `tap doctor --format json` currently fails.
- Exit codes do not distinguish failure classes.

This makes it hard for agents and automation wrappers to decide whether to fix arguments, run setup, start Chrome, retry later, or ask the user for intervention.

## Scope

### In Scope

- Add a shared structured error model for CLI failures.
- Define stable first-pass exit code semantics.
- Preserve human-readable error output by default for TTY usage.
- Support structured JSON error output when explicitly requested with `--format json`.
- Support JSON output for local management commands:
  - `tap doctor --format json`
  - `tap browser status --format json`
  - `tap browser start --format json`
  - `tap browser stop --format json`
  - `tap setup --format json`
- Keep existing successful data-command JSON envelope behavior unchanged.
- Update help/docs for the new JSON support and exit code semantics.

### Out of Scope

- `tap schema` or command introspection.
- Adapter argument type validation beyond current required-argument behavior.
- `--fields`, pagination, NDJSON, or context-budget controls.
- Dry-run or idempotency semantics for future write operations.
- Reworking adapter pipeline execution.
- Changing adapter file format.

## Requirements

### R1. Structured Error Model

When JSON output is requested, CLI failures should produce a machine-readable JSON object on stderr:

```json
{
  "error": {
    "code": "missing_required_arg",
    "message": "Missing required argument: --subreddit",
    "suggestion": "Run: tap reddit hot --subreddit <value>",
    "retryable": false,
    "details": {}
  }
}
```

Required fields:

- `error.code`: stable snake_case identifier.
- `error.message`: concise human-readable problem statement.
- `error.suggestion`: concrete next step when known, otherwise `null`.
- `error.retryable`: boolean.
- `error.details`: object for structured context; may be empty.

Human-readable errors may remain the default when JSON was not requested.

### R2. Exit Code Map

Implement and document these stable exit codes:

| Code | Name | Meaning | Agent Response |
|------|------|---------|----------------|
| 0 | success | Command completed successfully | Parse stdout |
| 1 | general_error | Unexpected or uncategorized failure | Inspect error; usually stop |
| 2 | usage_error | Invalid command, unknown option, missing required arg, unsupported format | Fix command invocation |
| 3 | config_error | Missing or invalid local TAP setup/config | Run `tap setup` or inspect config |
| 4 | browser_error | Chrome/CDP unavailable or browser-backed command cannot connect | Run `tap browser status` / `tap browser start` |
| 5 | upstream_error | Network, fetch, remote API, or target-site failure | Retry if marked retryable |
| 6 | adapter_contract_error | Adapter schema/output contract invalid | Fix adapter |

### R3. JSON Management Command Output

Management commands should support `--format json` while preserving current human text output by default.

#### `tap doctor --format json`

Expected successful shape:

```json
{
  "ok": true,
  "checks": [
    {
      "label": "TAP directory",
      "ok": true,
      "detail": "/Users/example/.tap"
    }
  ],
  "suggestions": []
}
```

If any check fails:

- exit code should be non-zero and should match the dominant failure class where practical.
- `ok` should be `false`.
- `suggestions` should include concrete commands such as `tap setup` or `tap browser start`.

#### `tap browser status --format json`

Expected shape:

```json
{
  "ok": true,
  "endpoint": "http://127.0.0.1:9222",
  "browser": "Chrome/147.0.7727.138",
  "webSocketDebuggerUrl": "ws://127.0.0.1:9222/devtools/browser/..."
}
```

When unavailable:

```json
{
  "ok": false,
  "endpoint": "http://127.0.0.1:9222",
  "error": "connect ECONNREFUSED 127.0.0.1:9222",
  "suggestions": ["tap browser start"]
}
```

#### `tap browser start --format json`

Return the existing `startBrowser()` result object as JSON, with enough fields for an agent to know whether Chrome was already running or just started.

#### `tap browser stop --format json`

Return the existing `stopBrowser()` result object as JSON.

#### `tap setup --format json`

Return the existing `runSetup()` result object as JSON.

### R4. Format Parsing for Management Commands

Management commands should accept `--format json`.

Unknown formats should fail as usage errors:

```json
{
  "error": {
    "code": "unsupported_format",
    "message": "Unsupported format: yaml",
    "suggestion": "Use --format json or omit --format for human-readable text.",
    "retryable": false,
    "details": { "format": "yaml", "supported": ["json"] }
  }
}
```

### R5. Compatibility

- Existing data command success output must remain unchanged.
- Existing human-readable `tap doctor`, `tap browser status`, and `tap setup` output should remain usable.
- Existing `--help` behavior should continue to exit `0`.
- Existing user adapters should not require changes.

## Acceptance Criteria

- [ ] `tap doctor --format json` prints valid JSON to stdout.
- [ ] `tap browser status --format json` prints valid JSON to stdout.
- [ ] `tap browser start --format json` prints valid JSON to stdout.
- [ ] `tap browser stop --format json` prints valid JSON to stdout.
- [ ] `tap setup --format json` prints valid JSON to stdout.
- [ ] `tap reddit hot --limit 1 --format json` with missing `--subreddit` prints a structured JSON error to stderr and exits `2`.
- [ ] Unknown site/command errors exit `2` and can be emitted as structured JSON when JSON format is requested.
- [ ] Adapter contract failures exit `6`.
- [ ] Browser/CDP failures for browser-backed commands exit `4`.
- [ ] Data command success JSON remains `{ meta, schema, items }`.
- [ ] Human-readable output remains the default for management commands without `--format json`.
- [ ] README documents the exit code map and JSON management-command examples.

## Technical Notes

- This is backend/runtime CLI work.
- Likely files:
  - `src/cli.js`: command parsing, failure handling, exit codes.
  - `src/output.js`: possible shared JSON helpers or error formatting.
  - `src/doctor.js`: JSON-friendly result shape and suggestions.
  - `src/browser.js`: JSON-friendly result shape and suggestions.
  - `src/setup.js`: JSON output path.
  - `src/help.js`: help text updates.
  - `README.md` and `README.zh.md`: documentation updates.
- Keep stdout/stderr separated:
  - Successful JSON goes to stdout.
  - Structured errors go to stderr.
- Prefer a small central error helper over scattered ad hoc objects.
- Do not infer JSON mode from non-TTY in Phase 1 unless explicitly decided during implementation. Explicit `--format json` is sufficient for this phase.

## Open Questions

- Should `--json` be added as an alias for `--format json`, or should Phase 1 keep only the existing `--format json` pattern?
- For `tap doctor --format json`, should a failed CDP check always exit `4`, even when setup checks also fail?
- Should JSON errors be emitted when `--format json` appears after an invalid site or command, where normal command parsing has not yet loaded a command?

## Non-Implementation Status

This PRD intentionally stops before implementation. The task has not been initialized with implementation/check context and has not been started as the current Trellis task.
