# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TAP** is a lightweight CLI tool for executing declarative data pipelines that fetch and transform data from web sources. It uses an adapter pattern where site-specific adapters define what to fetch; the core engine handles execution.

Usage: `tap <site> <command> [--key value] [--format table|json]`

## Build & Run

```bash
bun run build                  # produces standalone `tap` binary
bun run build:npm              # cross-compile for darwin-arm64, darwin-x64, linux-x64 → npm/binaries/
bun run bin/cli.js <site> <command>  # run directly during development
```

No test/lint/format scripts exist yet. Validate changes by running the affected command and checking both output formats:
```bash
bun run bin/cli.js bilibili hot --limit 5 --format table
bun run bin/cli.js bilibili hot --limit 5 --format json
```

## Architecture

### Entry Point
`bin/cli.js` — thin wrapper that imports and calls `src/cli.js#runCli()`.

### Core Modules
- **`src/cli.js`** — Arg parsing, help routing, pipeline orchestration. Determines whether a browser session is needed by checking if any step uses `navigate`/`evaluate`/`intercept`.
- **`src/executor.js`** — Pipeline execution engine. `executePipeline(steps, args, session)` runs steps sequentially, threading `data` through. Template expressions use `${{ expr }}` syntax with context vars: `item`, `index`, `args`, `data`, `root`.
- **`src/cdp.js`** — Chrome DevTools Protocol wrapper. `CDPSession` class + `openSession()`/`closeTab()`. Manages WebSocket communication, page navigation, JS evaluation, and network interception (patches `fetch` and `XMLHttpRequest` in-page).
- **`src/adapters.js`** — Adapter discovery and loading. `resolveAdapterPath()` searches directories in priority order (see below). `listAdapters()` scans all directories and deduplicates by site/command.
- **`src/output.js`** — `printOutput()` renders data as JSON or ASCII table.
- **`src/help.js`** — Generates help text at global, site, and command levels.

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
  columns: ['field1', 'field2'],  // table column order
  pipeline: [ /* ordered array of steps */ ],
};
```

### Pipeline Steps
Each step is `{ <op>: <params> }`. Steps execute sequentially, threading `data`:

| Step | Params | Description |
|------|--------|-------------|
| `fetch` | URL string or `{ url }` | HTTP GET → parsed JSON. No browser needed. |
| `navigate` | URL string | Open URL in browser, wait for load + 800ms SPA settle. |
| `evaluate` | JS string | Run JS in browser context (async-capable). Replaces `data` with return value. |
| `intercept` | `{ capture, trigger, timeout, select }` | Patch fetch/XHR to capture matching network requests. `trigger` prefixes: `navigate:`, `evaluate:`, `click:`, `scroll`. |
| `select` | Dot-path string | Extract nested value. Supports `[*]` wildcard for array flattening, `["key"]` for bracket notation. |
| `map` | `{ [key]: "${{ expr }}" }` | Transform array items. Optional `select` key sub-selects before mapping. Context: `item`, `index`, `args`, `data`, `root`. |
| `filter` | JS expression string | Retain items where expression is truthy. Context: `item`, `index`, `args`, `data`. |
| `sort` | `{ by, order }` or field string | Sort by field. `order: 'desc'` for reverse. Uses natural sort. |
| `limit` | Number or `"${{ args.limit }}"` | Slice array to N items. |

### Execution Flow
```
CLI Args → listAdapters() → loadAdapter(site, cmd)
         → needsBrowser check (navigate|evaluate|intercept in pipeline)
         → if browser: openSession() → new CDP tab
         → executePipeline(steps, args, session)
         → printOutput(data, format, columns)
         → closeTab()
```

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `TAP_CDP_ENDPOINT` | `http://localhost:9222` | Chrome DevTools Protocol endpoint |
| `TAP_ADAPTERS_DIR` | (none) | Additional adapter directory (searched first) |

## Key Dependency
- **ws** (`^8.0.0`): WebSocket client for CDP communication with Chrome.

## Commit Style
Scoped Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `chore(task):`.
