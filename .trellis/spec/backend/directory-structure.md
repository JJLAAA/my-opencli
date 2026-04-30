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
- Bundled skill source lives at `skills/tap-adapter-author/`
- Runtime lookup uses `<assetsRoot>/skills/tap-adapter-author`, where `assetsRoot` is one of:
  - `TAP_PACKAGE_ROOT` when an npm wrapper launches the binary
  - repo root for source execution
  - executable directory for standalone binary execution
- npm packages bundle `skills/tap-adapter-author/`, but `postinstall` must not write to assistant-specific directories

### Local Setup and Browser Runtime Commands

#### 1. Scope / Trigger

Use this contract when adding or changing local TAP state, bundled adapter installation, browser runtime management, or diagnostics. These commands are user-facing CLI contracts and must stay explicit: package installation must not initialize `~/.tap`.

#### 2. Signatures

```bash
tap setup [--force]
tap browser start [--headless]
tap browser status
tap browser stop
tap doctor
```

Core modules:

- `src/setup.js`: exports `runSetup(options)`, `formatSetupResult(result)`, `setupHelp()`
- `src/browser.js`: exports `startBrowser(options)`, `browserStatus()`, `stopBrowser()`, formatters, and `browserHelp(command)`
- `src/doctor.js`: exports `runDoctor()`, `formatDoctorResult(result)`, `doctorHelp()`
- `src/config.js`: exports default paths and configuration helpers

#### 3. Contracts

Default local state:

- TAP directory: `~/.tap/`
- User adapter directory: `~/.tap/adapters/`
- Log directory: `~/.tap/logs/`
- Config file: `~/.tap/config.json`
- Config fields: `cdpEndpoint`, `chromeProfile`
- Default `cdpEndpoint`: `http://localhost:9222`
- Default `chromeProfile`: `~/.chrome-automation-profile`
- Environment overrides: `TAP_CDP_ENDPOINT`, `TAP_ADAPTERS_DIR`, `TAP_CHROME_PATH`

Bundled adapter lookup must support both source and npm binary layouts:

- `<repo>/adapters`
- `<dirname(process.execPath)>/adapters`
- `<dirname(process.execPath)>/../adapters`

Side commands must route in `src/cli.js` before adapter discovery and delegate all behavior to focused `src/` modules.

#### 4. Validation & Error Matrix

| Case | Expected behavior |
|------|-------------------|
| `tap setup` and bundled adapters are missing | Exit non-zero with `Bundled adapters not found.` |
| `tap setup` finds existing adapter files | Keep them and report skipped files |
| `tap setup --force` finds existing adapter files | Overwrite bundled adapter files and report installed files |
| `tap browser status` cannot reach CDP | Exit non-zero and print endpoint plus connection error |
| `tap browser start` cannot find Chrome | Exit non-zero and ask user to set `TAP_CHROME_PATH` |
| `tap browser stop` when CDP is unreachable | Exit zero and report that agent Chrome was not running |
| `tap doctor` has any failed required check | Exit non-zero and print suggested next steps |

#### 5. Good/Base/Bad Cases

- Good: `HOME=/tmp/tap-verify tap setup` creates only files under that HOME and installs bundled adapters.
- Base: running `tap setup` twice skips existing adapters unless `--force` is provided.
- Bad: npm `postinstall` writes to `~/.tap` or assistant-specific directories.

#### 6. Tests Required

Manual checks are required until this repo has a test suite:

```bash
HOME=/tmp/tap-verify bun run bin/cli.js setup
HOME=/tmp/tap-verify bun run bin/cli.js setup
HOME=/tmp/tap-verify bun run bin/cli.js setup --force
HOME=/tmp/tap-verify bun run bin/cli.js doctor
HOME=/tmp/tap-verify bun run bin/cli.js browser status
bun run build
bun run build:npm
HOME=/tmp/tap-verify-npm node npm/run.js setup
```

Assertion points:

- Setup creates directories and config in the overridden HOME only.
- Existing adapter files are skipped without `--force`.
- Doctor reports pass/fail rows and exits non-zero when CDP is unavailable.
- npm package wrapper can find `npm/adapters`.

#### 7. Wrong vs Correct

Wrong:

```js
// npm/install.js
copyDir(path.join(__dirname, 'adapters'), path.join(os.homedir(), '.tap', 'adapters'));
```

Correct:

```js
// src/setup.js
runSetup({ force: false });
```

Initialization of user-owned files belongs behind the explicit `tap setup` command, not npm lifecycle hooks.

---

## Naming Conventions

- Files: `kebab-case.js`
- Adapters: `adapters/<site>/<command>.js` — site and command names are lowercase, no hyphens
- Compiled binary: `tap` (no extension)

---

## Examples

- Core module pattern: `src/cdp.js` — one class + two exported functions, no side effects
- Adapter pattern: `adapters/bilibili/hot.js` — single default export with `args`, `columns`, `pipeline`
