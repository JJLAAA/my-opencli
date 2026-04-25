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
- **`src/cdp.js`** — Chrome DevTools Protocol wrapper. `CDPSession` class + `openSession()`/`closeTab()` for browser lifecycle.
- **`src/executor.js`** — Pipeline execution engine. `executePipeline()` runs declarative steps: `fetch`, `navigate`, `evaluate`, `filter`, `map`, `limit`. Template values use `${{ expression }}` syntax.
- **`src/output.js`** — Output formatter. `printOutput()` renders data as JSON or ASCII table.

### Adapter Pattern
Adapters live in `adapters/<site>/<command>.js` and are installed to `~/.tap/adapters/` for use. Each adapter exports:
```js
export const args = { /* CLI arg definitions with defaults */ };
export const pipeline = [ /* ordered array of operation steps */ ];
export const columns = [ /* field names for table output */ ];
```

### Execution Flow
```
CLI Args → Load Adapter (~/.tap/adapters/<site>/<command>.js)
         → executePipeline(steps, args)
         → printOutput(data, format, columns)
```

## Key Dependency
- **ws** (`^8.0.0`): WebSocket client for CDP communication with Chrome.
