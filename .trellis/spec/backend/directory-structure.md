# Directory Structure

> How backend code is organized in this project.

---

## Overview

TAP is a CLI tool with no traditional backend server. "Backend" refers to the core engine: CDP session management, pipeline execution, and output formatting.

---

## Directory Layout

```
tap/
├── bin/
│   └── cli.js          # Entry point — arg parsing, adapter loading, orchestration
├── src/
│   ├── cdp.js          # Chrome DevTools Protocol session management
│   ├── executor.js     # Pipeline execution engine
│   ├── skills.js       # Explicit AI assistant skill installation
│   └── output.js       # Output formatter (table / json)
├── adapters/           # Built-in adapters (installed to ~/.tap/adapters/ for use)
│   ├── bilibili/
│   │   └── hot.js
│   └── linuxdo/
│       └── news.js
└── tap                 # Compiled bun single-file executable
```

---

## Module Organization

Each core module is a single file with a clear, single responsibility:

- `bin/cli.js` — orchestration only, no business logic
- `src/cdp.js` — exports `openSession()` and `closeTab()`, contains `CDPSession` class
- `src/executor.js` — exports `executePipeline(pipeline, args, session)`
- `src/skills.js` — exports `installSkill(providerName, options)` and `skillHelp(command)` for explicit skill installation
- `src/output.js` — exports `printOutput(data, format, columns)`

New core capabilities go in `src/` as their own file. Do not add logic to `bin/cli.js`.

### CLI Side Commands

Side commands that are not adapter executions must be routed before adapter discovery in `src/cli.js`, then delegate behavior to a focused `src/` module.

Current side command:

```bash
tap skill install <claude-code|codex> [--target dir] [--force]
```

Contract:

- `claude-code` defaults to `~/.claude/skills/tap-adapter-author`
- `codex` defaults to `$CODEX_HOME/skills/tap-adapter-author`, or `~/.codex/skills/tap-adapter-author` when `CODEX_HOME` is unset
- `--target <dir>` means the parent skills directory; the command appends `tap-adapter-author`
- Existing target directories are not overwritten unless `--force` is passed
- npm packages may bundle `skills/tap-adapter-author/`, but `postinstall` must not write to assistant-specific directories

---

## Naming Conventions

- Files: `kebab-case.js`
- Adapters: `adapters/<site>/<command>.js` — site and command names are lowercase, no hyphens
- Compiled binary: `tap` (no extension)

---

## Examples

- Core module pattern: `src/cdp.js` — one class + two exported functions, no side effects
- Adapter pattern: `adapters/bilibili/hot.js` — single default export with `args`, `columns`, `pipeline`
