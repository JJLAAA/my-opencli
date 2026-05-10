# Directory Structure

> How core engine code is organized in this project.

---

## Overview

TAP is a CLI tool with no traditional backend server. "Core" refers to the execution engine: CDP session management, pipeline execution, output formatting, side-command dispatch, and package/runtime support.

---

## Directory Layout

```
tap/
├── bin/
│   └── cli.js          # Entry point — shebang, calls runCli()
├── src/
│   ├── adapters.js     # Adapter discovery and loading
│   ├── adapter-manager.js  # Adapter pack install/list/remove
│   ├── browser.js      # Agent Chrome lifecycle management
│   ├── bundled-skills.js   # Embed skill files in standalone binary
│   ├── cdp.js          # Chrome DevTools Protocol session management
│   ├── cli.js          # Arg parsing, subcommand dispatch, pipeline orchestration
│   ├── config.js       # Config read, path helpers
│   ├── doctor.js       # Local setup diagnostics
│   ├── executor.js     # Pipeline execution engine
│   ├── help.js         # Help text generation
│   ├── output.js       # Output formatter (table / JSON)
│   ├── schema.js       # Machine-readable command schema
│   ├── setup.js        # ~/.tap initialization
│   ├── skills.js       # Explicit AI assistant skill installation
│   └── version.js      # TAP_VERSION export
├── npm/                # npm wrapper and generated platform packages
│   └── platforms/
├── scripts/            # Build scripts (build-npm.js, publish-npm.js)
├── skills/             # TAP-owned bundled assistant skills
│   └── tap-adapter-author/
└── tap                 # Compiled bun single-file executable
```

---

## Module Organization

Each core module is a single file with a clear, single responsibility:

- `bin/cli.js` — orchestration only, no business logic
- `src/cdp.js` — exports `openSession()` and `closeTab()`, contains `CDPSession` class
- `src/executor.js` — exports `executePipeline(pipeline, args, session)`
- `src/skills.js` — exports `installSkill(providerName, options)` and `skillHelp(command)` for explicit skill installation
- `src/output.js` — exports `printOutput(data, format, options)` and renders schema-aware JSON envelopes or tables

New core capabilities go in `src/` as their own file. Do not add logic to `bin/cli.js`.

### CLI Side Commands

Side commands that are not adapter executions must be routed before adapter discovery in `src/cli.js`, then delegate behavior to a focused `src/` module.

Current side-command families:

```bash
tap skill install <claude-code|codex> [--target dir] [--force]
tap setup [--force]
tap browser start [--headless] [--foreground]
tap browser status
tap browser stop
tap browser restart [--headless] [--foreground]
tap doctor
tap adapter install <source> [--force]
tap adapter list
tap adapter remove <pack-name>
```

Contracts live in focused files:

- Skill installation assets and standalone binary fallback: `src/skills.js`, `src/bundled-skills.js`, `skills/tap-adapter-author/`.
- Local setup, browser runtime, diagnostics, and config state: [Local Runtime](./local-runtime.md).
- Npm wrapper, platform packages, and publish flow: [Npm Distribution](./npm-distribution.md).
- Adapter pack management: [Adapter Pack Management](../adapters/adapter-pack-management.md).

---

## Naming Conventions

- Files: `kebab-case.js`
- Adapters: `adapters/<site>/<command>.js` — site and command names are lowercase, no hyphens
- Compiled binary: `tap` (no extension)

---

## Examples

- Core module pattern: `src/cdp.js` — one class + two exported functions, no side effects
- Adapter pattern: `adapters/<site>/<command>.js` — single default export with `args`, `output.fields`, optional `columns`, and `pipeline`
