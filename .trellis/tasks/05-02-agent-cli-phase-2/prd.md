# Agent-Friendly CLI Phase 2

## Goal

Reduce agent command hallucination by making TAP commands machine-discoverable before execution.

Phase 2 focuses on command/schema introspection and adapter argument contracts:

1. Agents can ask TAP what commands exist.
2. Agents can inspect one command's required args, defaults, types, enum values, and output schema.
3. TAP validates adapter args early and returns actionable structured errors.
4. Adapter authors get a clear metadata contract for agent-facing commands.

## Background

Phase 1 establishes the agent self-recovery path:

- structured JSON errors,
- stable exit code classes,
- JSON output for `doctor`, `browser`, and `setup`.

The remaining high-impact gap is first-attempt correctness. Today an agent can read human help, but there is no machine-readable command definition. That creates predictable failure modes:

- guessing `--subreddit` vs `--community`,
- passing string values where numbers are expected,
- inventing enum values,
- missing required args because help text is not structured,
- misunderstanding output fields or field meanings.

Phase 2 should make TAP discoverable as a small local API surface without changing pipeline execution semantics.

## Scope

### In Scope

- Add machine-readable CLI introspection.
- Add adapter arg metadata fields and runtime validation.
- Add structured validation errors for invalid args.
- Document the adapter arg contract.
- Keep current human help behavior.
- Keep existing adapters working with minimal or no changes.

### Out of Scope

- Field projection with `--fields`.
- Pagination, `--page-token`, or NDJSON streaming.
- Dry-run or idempotency semantics.
- Adapter pipeline language changes unrelated to args/schema.
- Auto-generating adapters from schemas.
- Supporting table/csv output.
- Network or browser runtime changes.

## Requirements

### R1. Global Schema Introspection

Add a machine-readable command that lists available TAP command surfaces.

Candidate interface:

```bash
tap schema --format json
```

Expected shape:

```json
{
  "meta": {
    "schemaVersion": 1,
    "generatedAt": "2026-05-02T00:00:00.000Z"
  },
  "commands": [
    {
      "kind": "adapter",
      "site": "reddit",
      "command": "hot",
      "name": "reddit hot",
      "description": "Fetch hot posts from a subreddit.",
      "schemaCommand": "tap schema reddit hot --format json"
    },
    {
      "kind": "management",
      "name": "doctor",
      "description": "Diagnose local TAP setup.",
      "schemaCommand": "tap schema doctor --format json"
    }
  ]
}
```

The output should include:

- adapter commands discovered from adapter directories,
- management commands where useful (`doctor`, `browser status/start/stop`, `setup`, `skill install` if supported),
- enough information for an agent to decide the next introspection call.

### R2. Per-Command Schema Introspection

Add machine-readable schema for one command.

Candidate interfaces:

```bash
tap schema <site> <command> --format json
tap schema doctor --format json
tap schema browser status --format json
```

Expected adapter command shape:

```json
{
  "meta": {
    "schemaVersion": 1,
    "kind": "adapter",
    "site": "reddit",
    "command": "hot",
    "name": "reddit hot"
  },
  "description": "Fetch hot posts from a subreddit.",
  "args": [
    {
      "name": "subreddit",
      "flag": "--subreddit",
      "type": "string",
      "required": true,
      "description": "Subreddit name without the r/ prefix.",
      "default": null,
      "enum": null,
      "format": null,
      "examples": ["ClaudeAI"]
    },
    {
      "name": "limit",
      "flag": "--limit",
      "type": "integer",
      "required": false,
      "description": "Maximum number of posts to return.",
      "default": 30,
      "minimum": 1,
      "maximum": 100
    }
  ],
  "output": {
    "type": "array",
    "itemName": "post",
    "items": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "description": "Post title."
        }
      }
    }
  },
  "examples": [
    {
      "description": "Fetch five hot posts.",
      "command": "tap reddit hot --subreddit ClaudeAI --limit 5 --format json"
    }
  ]
}
```

### R3. Adapter Args Contract

Extend adapter `args` metadata to support these fields:

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `name` | string | yes | Long flag name without `--` |
| `description` | string | recommended, required for new docs | Human/agent-facing meaning |
| `type` | string | recommended | `string`, `integer`, `number`, `boolean` |
| `required` | boolean | no | Whether the arg must be provided |
| `default` | any | no | Default value when omitted |
| `enum` | array | no | Allowed values |
| `minimum` | number | no | Numeric lower bound |
| `maximum` | number | no | Numeric upper bound |
| `format` | string | no | Semantic format such as `url`, `date`, `iso8601`, `subreddit` |
| `examples` | array | no | Valid example values |

Existing adapters without `type` and `description` should remain runnable in Phase 2, but schema output should normalize missing metadata conservatively.

Suggested defaults:

- If `type` is missing and `default` is a number, infer `number` or `integer`.
- If `type` is missing and `default` is boolean, infer `boolean`.
- Otherwise default to `string`.
- If `description` is missing, emit `description: null` and include a warning in schema output.

### R4. Runtime Arg Validation

Validate args before pipeline execution.

Validation should catch:

- unknown flags,
- missing required args,
- invalid enum values,
- invalid integer/number values,
- invalid boolean values,
- numeric values outside `minimum`/`maximum`.

Invalid args should fail with exit code `2` and structured JSON errors when JSON mode is requested.

Example:

```json
{
  "error": {
    "code": "invalid_arg_type",
    "message": "Invalid value for --limit: expected integer.",
    "suggestion": "Use --limit with an integer value, for example: --limit 10.",
    "retryable": false,
    "details": {
      "arg": "limit",
      "flag": "--limit",
      "expected": "integer",
      "received": "abc"
    }
  }
}
```

### R5. Boolean Arg Semantics

If an adapter declares `{ name: "includeArchived", type: "boolean" }`, these forms should be considered:

```bash
tap site command --includeArchived
tap site command --includeArchived true
tap site command --includeArchived false
```

The PRD does not require short aliases or `--no-includeArchived` in Phase 2.

### R6. Help Text Uses Arg Metadata

Human help should become more informative while staying concise:

```text
Options:
  --subreddit <string>   Subreddit name without r/ prefix. required
  --limit <integer>      Maximum number of posts to return. default: 30
```

If enum values exist, show them inline:

```text
  --sort <hot|new|top>   Listing sort. default: "hot"
```

### R7. Documentation

Update docs to cover:

- `tap schema` usage,
- per-command schema examples,
- adapter `args` metadata contract,
- validation errors and exit code behavior,
- migration guidance for existing adapters.

## Acceptance Criteria

- [ ] `tap schema --format json` lists adapter commands and management commands in valid JSON.
- [ ] `tap schema reddit hot --format json` returns valid command schema with `args` and `output`.
- [ ] `tap schema doctor --format json` returns valid management command schema.
- [ ] Existing data commands still run without requiring adapter changes.
- [ ] Unknown flags fail before pipeline execution with exit code `2`.
- [ ] Missing required args still fail with exit code `2`.
- [ ] Invalid integer args fail with exit code `2` and a structured `invalid_arg_type` error in JSON mode.
- [ ] Invalid enum values fail with exit code `2` and a structured `invalid_arg_value` error in JSON mode.
- [ ] Help output includes arg type/default/required/enum metadata when available.
- [ ] README and README.zh document `tap schema` and adapter arg metadata.

## Technical Notes

- This is backend/runtime CLI work.
- Likely files:
  - `src/cli.js`: route `schema`, parse/validate args, unknown flag handling.
  - `src/help.js`: richer help text from arg metadata.
  - `src/output.js`: possible schema builders/shared metadata normalization.
  - `src/adapters.js`: command discovery data may need descriptions.
  - new `src/schema.js` or similar: command schema generation.
  - `README.md`, `README.zh.md`: documentation.
  - bundled skill docs: update adapter-author guidance if needed.
- Prefer central arg normalization/validation over ad hoc checks in `src/cli.js`.
- Schema output should be versioned with `schemaVersion: 1`.
- Keep stdout/stderr rules from Phase 1:
  - successful schemas go to stdout,
  - structured errors go to stderr.

## Design Decisions To Confirm Before Implementation

- Exact command shape:
  - preferred: `tap schema [site] [command] --format json`
  - alternative: `tap <site> <command> --schema`
- Whether schema output should support human text, or require `--format json`.
- Whether `integer` and `number` should both be supported, or whether `number` is enough.
- Whether `description` should become required for adapter args in Phase 2 or only warned.
- Whether management command schemas should be hand-authored or generated from shared metadata.

## Non-Implementation Status

This PRD intentionally stops before implementation. The task has not been initialized with implementation/check context and has not been started as the current Trellis task.
