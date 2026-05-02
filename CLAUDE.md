# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TAP** is a lightweight CLI tool for executing declarative data pipelines that fetch and transform data from web sources. It uses an adapter pattern where site-specific adapters define what to fetch; the core engine handles execution.

Usage: `tap <site> <command> [--key value] [--format json]`

## Build & Run

```bash
bun run build                  # produces standalone `tap` binary
bun run build:npm              # cross-compile for darwin-arm64, darwin-x64, linux-x64 → npm/binaries/
bun run bin/cli.js <site> <command>  # run directly during development
```

No test/lint/format scripts exist yet. Validate changes by running the affected command and checking output:
```bash
bun run bin/cli.js <site> <command> --limit 5 --format json
```

## Architecture

### Entry Point
`bin/cli.js` — thin wrapper that imports and calls `src/cli.js#runCli()`.

### Core Modules
- **`src/cli.js`** — Arg parsing, help routing, pipeline orchestration, structured error handling. `--format json` is detected globally before dispatch. `fail()` outputs structured JSON errors to stderr when JSON mode is active. Exit codes: 0 (success), 1 (general), 2 (usage), 3 (config), 4 (browser), 5 (upstream), 6 (adapter contract). Dispatches subcommands: adapter execution, `help`, `setup`, `doctor`, `browser start/stop/status`, `skill install`.
- **`src/executor.js`** — Pipeline execution engine. `executePipeline(steps, args, session)` runs steps sequentially, threading `data` and `state` through. Steps can save results with `as` and read them later with `from`. Template expressions use `${{ expr }}` syntax with context vars: `item`, `index`, `args`, `data`, `state`, `root`.
- **`src/cdp.js`** — Chrome DevTools Protocol wrapper. `CDPSession` class + `openSession()`/`closeTab()`. Manages WebSocket communication, page navigation, JS evaluation, and network interception (patches `fetch` and `XMLHttpRequest` in-page).
- **`src/adapters.js`** — Adapter discovery and loading. `resolveAdapterPath()` searches directories in priority order (see below). `listAdapters()` scans all directories and deduplicates by site/command.
- **`src/output.js`** — `printOutput()` renders schema-aware JSON envelopes for data commands.
- **`src/help.js`** — Generates help text at global, site, and command levels.
- **`src/browser.js`** — Manages the agent Chrome lifecycle: `startChrome()`, `stopChrome()`, `browserStatus()`. Uses a dedicated `~/.chrome-automation-profile` to isolate agent browsing from the user's daily Chrome. `startChrome` supports `--foreground` (normal window) and `--headless` (hidden) flags; default is minimized.
- **`src/setup.js`** — `runSetup()` initializes `~/.tap/`, writes default `config.json`, installs bundled adapters.
- **`src/doctor.js`** — Diagnoses local setup (config, adapters, Chrome, CDP connectivity).
- **`src/skills.js`** — `installSkill()` copies the bundled skill to AI assistant skill directories (Claude Code, Codex).
- **`src/bundled-skills.js`** — Embeds the `tap-adapter-author` skill in the standalone binary.
- **`src/config.js`** — `readConfig()`, `getConfigDir()`, `getCDPEndpoint()`. Reads `~/.tap/config.json`.

### Adapter Resolution (Search Order)
1. `TAP_ADAPTERS_DIR` env var (if set)
2. `~/.tap/adapters/` (user adapters)
3. `adapters/` in repo root (built-in)

User adapters override built-ins when both exist for the same site/command.

### Adapter Shape
```js
// adapters/<site>/<command>.js
export default {
  description: 'Short description shown in help.',
  args: [{ name: 'limit', default: 20, description: 'Max items.' }],
  output: {
    type: 'list',
    itemName: 'item',
    fields: {
      field1: { type: 'string', description: 'First output field.' },
      field2: { type: 'string', description: 'Second output field.' },
    },
  },
  columns: ['field1', 'field2'],  // table column order
  pipeline: [ /* ordered array of steps */ ],
};
```

`--format json` requires `output.fields` and emits `{ meta, schema, items }`. JSON items are projected to declared schema fields only; undeclared pipeline fields are dropped.

### Pipeline Steps
Each step is `{ <op>: <params> }`. Steps execute sequentially, threading `data`. Steps can save results into `state` with `as` and read from named state with `from`.

| Step | Params | Description |
|------|--------|-------------|
| `fetch` | URL string or `{ url, as? }` | HTTP GET → parsed JSON. No browser needed. |
| `browserFetch` | `{ url, as?, method?, headers?, body?, credentials? }` | Runs page-context `fetch()` with cookies. Requires browser. |
| `navigate` | URL string | Open URL in browser, wait for load + 800ms SPA settle. |
| `evaluate` | JS string or `{ code, as? }` | Run JS in browser context (async-capable). Replaces `data` with return value. |
| `intercept` | `{ capture, trigger?, timeout?, select?, as? }` | Patch fetch/XHR to capture matching network requests. `trigger` prefixes: `navigate:`, `evaluate:`, `click:`, `scroll`. |
| `select` | Path string or `{ from?, path?, as? }` | Extract nested value. Supports `[*]` wildcard, `["key"]` bracket notation. `from` reads from `state`. |
| `map` | `{ select?, ...fields }` | Transform array items. Optional `select` key sub-selects before mapping. |
| `mapOne` | `{ ...fields }` | Transform current value into one object (mainly inside `foreach`). |
| `foreach` | `{ from?, as?, concurrency?, steps }` | Iterate array, run nested pipeline per item with bounded concurrency. Nested steps get `item`/`index`; `as` saves collected results. |
| `filter` | JS expression string | Retain items where expression is truthy. Context: `item`, `index`, `args`, `data`, `state`. |
| `sort` | `{ by, order }` or field string | Sort by field. `order: 'desc'` for reverse. |
| `limit` | Number or `"${{ args.limit }}"` | Slice array to N items. |

### State Management
Steps that accept `as` save their result into a shared `state` object. Later steps read from state via `select: { from: 'name' }` or `foreach: { from: 'name' }`. `foreach` nested steps inherit a copy of state; their local `as` values do not mutate the parent state.

### Execution Flow
```
CLI Args → listAdapters() → loadAdapter(site, cmd)
         → needsBrowser check (navigate|evaluate|browserFetch|intercept in pipeline)
         → if browser: openSession() → new CDP tab
         → executePipeline(steps, args, session)
         → printOutput(data, format, { adapter, site, command, args })
         → closeTab()
```

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `TAP_CDP_ENDPOINT` | `http://127.0.0.1:9222` | Chrome DevTools Protocol endpoint |
| `TAP_ADAPTERS_DIR` | (none) | Additional adapter directory (searched first) |
| `TAP_CHROME_PATH` | (auto-detected) | Chrome executable path for `tap browser start` |

## Exit Codes

| Code | Name | When |
|------|------|------|
| 0 | success | Command completed |
| 1 | general_error | Unexpected failure |
| 2 | usage_error | Bad invocation, unknown option, missing arg, unsupported format |
| 3 | config_error | Missing/invalid TAP setup |
| 4 | browser_error | Chrome/CDP unavailable |
| 5 | upstream_error | Network or remote API failure |
| 6 | adapter_contract_error | Invalid adapter output schema |

When `--format json` is set, errors produce `{ error: { code, message, suggestion, retryable, details } }` on stderr. Management commands (`doctor`, `browser`, `setup`) output JSON to stdout when `--format json` is given; human text otherwise.

## Commit Style
Scoped Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `chore(task):`.
