# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TAP** is a lightweight CLI tool for executing declarative data pipelines that fetch and transform data from web sources. It uses an adapter pattern where site-specific adapters define what to fetch; the core engine handles execution.

Usage: `tap <site> <command> [--key value] [--format table|json]`

## Build

```bash
bun build --compile bin/cli.js --outfile tap
```

This produces a standalone `tap` binary via Bun's single-file executable feature.

## Architecture

### Entry Point
`bin/cli.js` — parses CLI args, loads the user's adapter from `~/.tap/adapters/<site>/<command>.js`, and orchestrates pipeline execution.

### Core Modules
- **`src/cdp.js`** — Chrome DevTools Protocol wrapper. `CDPSession` class + `openSession()`/`closeTab()` for browser lifecycle. Connects to Chrome via `TAP_CDP_ENDPOINT` (default: `http://localhost:9222`).
- **`src/executor.js`** — Pipeline execution engine. `executePipeline()` runs declarative steps sequentially. Template values use `${{ expression }}` syntax with context vars `item`, `index`, `args`, `data`, `root`.
- **`src/output.js`** — Output formatter. `printOutput()` renders data as JSON or ASCII table.

### Adapter Pattern
Adapters live in `adapters/<site>/<command>.js` and are installed to `~/.tap/adapters/` for use. Each adapter exports a default object:
```js
export default {
  args: [{ name: 'limit', default: 20 }],  // CLI params with defaults
  columns: ['field1', 'field2'],            // table column order
  pipeline: [ /* ordered array of operation steps */ ],
};
```

### Pipeline Steps
Each step is an object with a single key naming the operation:

| Step | Description |
|------|-------------|
| `fetch` | HTTP GET, returns parsed JSON. Params: `{ url }` or a plain URL string. |
| `navigate` | Open URL in browser and wait for page load. |
| `evaluate` | Run JS in browser context (async-capable), replaces `data` with return value. |
| `intercept` | Capture network requests matching a URL pattern. Params: `{ capture, trigger, timeout, select }`. `trigger` prefixes: `navigate:`, `evaluate:`, `click:`, `scroll`. |
| `select` | Extract a nested value from `data` by dot-path (e.g. `"data.list"`). |
| `map` | Transform array items into new objects using template expressions. Supports inline `select` key to sub-select before mapping. |
| `filter` | Retain items where JS expression is truthy. Context: `item`, `index`, `args`, `data`. |
| `sort` | Sort array by field. Params: `{ by, order }` — `order: 'desc'` for reverse. |
| `limit` | Slice array to N items. Supports template expressions (e.g. `"${{ args.limit }}"`). |

### Execution Flow
```
CLI Args → Load Adapter (~/.tap/adapters/<site>/<command>.js)
         → executePipeline(steps, args, cdpSession)
         → printOutput(data, format, columns)
```

## Key Dependency
- **ws** (`^8.0.0`): WebSocket client for CDP communication with Chrome.
