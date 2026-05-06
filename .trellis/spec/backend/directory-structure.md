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
- Standalone binaries must also embed `tap-adapter-author` Markdown files through static imports and fall back to writing those embedded files when no assets root exists. This keeps `tap skill install ...` working after a user moves only the compiled `tap` binary to a directory such as `/usr/local/bin`.
- npm packages bundle `skills/tap-adapter-author/`, but `postinstall` must not write to assistant-specific directories

### Local Setup and Browser Runtime Commands

#### 1. Scope / Trigger

Use this contract when adding or changing local TAP state, browser runtime management, or diagnostics. These commands are user-facing CLI contracts and must stay explicit: package installation must not initialize `~/.tap`.

#### 2. Signatures

```bash
tap setup [--force]
tap browser start [--headless] [--foreground]
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
- Default `cdpEndpoint`: `http://127.0.0.1:9222`
- Default `chromeProfile`: `~/.chrome-automation-profile`
- Environment overrides: `TAP_CDP_ENDPOINT`, `TAP_ADAPTERS_DIR`, `TAP_CHROME_PATH`
- `tap browser start` creates the configured Chrome profile directory before spawning Chrome.
- `tap browser start` starts headed Chrome minimized by default with `--start-minimized`; `--foreground` opts back into normal headed startup.
- `tap browser start --headless` keeps the existing no-window mode and must not add `--start-minimized`.
- Browser-backed adapter runs create an `about:blank` CDP target through the Browser websocket using `Target.createTarget({ url, background: true })` before connecting to that page target. This is a best-effort focus-reduction hint; cleanup still uses `closeTab(base, targetId)`.

Side commands must route in `src/cli.js` before adapter discovery and delegate all behavior to focused `src/` modules.

#### 4. Validation & Error Matrix

| Case | Expected behavior |
|------|-------------------|
| `tap setup` runs without existing local state | Create TAP directories/config; do not install adapters |
| `tap setup` runs with existing config | Keep config and report `written: false` |
| `tap setup --force` runs with existing config | Overwrite config and report `written: true` |
| `tap browser status` cannot reach CDP | Exit non-zero and print endpoint plus connection error |
| `tap browser start` cannot find Chrome | Exit non-zero and ask user to set `TAP_CHROME_PATH` |
| `tap browser stop` when CDP is unreachable | Exit zero and report that agent Chrome was not running |
| `tap doctor` has any failed required check | Exit non-zero and print suggested next steps |

#### 5. Good/Base/Bad Cases

- Good: `HOME=/tmp/tap-verify tap setup` creates only files under that HOME.
- Base: running `tap setup` twice keeps existing config unless `--force` is provided.
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
- Setup output includes `adaptersTarget` and no bundled-adapter install result fields.
- Doctor reports pass/fail rows and exits non-zero when CDP is unavailable.
- npm package wrapper can run setup without adapter package assets.

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

## Npm Distribution Split Packages

### 1. Scope / Trigger

Use this contract when changing npm package layout, platform binary build outputs, publish scripts, or the npm wrapper runtime.

This is an infra/cross-layer contract because these files must agree:

- `scripts/build-npm.js`
- `scripts/publish-npm.js`
- `.github/workflows/publish-npm.yml`
- `npm/package.json`
- `npm/run.js`
- `npm/install.js`
- generated `npm/platforms/<package>/package.json`

### 2. Signatures

```bash
bun run build:npm
bun run publish:npm
node npm/run.js <tap args>
```

Generated package directories:

```text
npm/platforms/tap-darwin-arm64/
npm/platforms/tap-darwin-x64/
npm/platforms/tap-linux-x64/
```

Platform package names:

```text
@leolee812/tap-darwin-arm64
@leolee812/tap-darwin-x64
@leolee812/tap-linux-x64
```

### 3. Contracts

- Main package name: `@leolee812/tap`
- Main npm package files:
  - `run.js`
  - `install.js`
  - `skills/`
- Main npm package must not include:
  - `binaries/`
  - `platforms/`
  - compiled platform binaries
- Main package `optionalDependencies` must pin each platform package to the same version as root `package.json`.
- Each platform package contains exactly:
  - `package.json`
  - `bin/tap`
- Each platform package declares `os` and `cpu` constraints matching its binary.
- `npm/run.js` maps `process.platform` + `process.arch` to a platform package name.
- `npm/run.js` resolves the published platform package through `require.resolve("<pkg>/bin/tap")`.
- `npm/run.js` must also support local development fallback at `npm/platforms/<package-dir>/bin/tap` after `bun run build:npm`.
- `npm/run.js` must launch the binary with `TAP_PACKAGE_ROOT=__dirname` so `tap skill install ...` reads bundled skills from the main package.
- `npm/install.js` may set executable bits for local generated binaries under `npm/platforms/`, but must not create or modify `~/.tap`, assistant directories, or user adapter directories.
- `scripts/publish-npm.js` must publish platform packages before publishing the main package.
- `scripts/publish-npm.js` must skip exact package versions that are already published so a partial publish can resume safely.
- `.github/workflows/publish-npm.yml` is the preferred publish path. It must read npm credentials from `secrets.NPM_TOKEN`, run package dry-runs, and call `bun run scripts/publish-npm.js`.
- `NPM_PUBLISH_DRY_RUN=1` must use `npm pack --dry-run` for each package, not `npm publish --dry-run`, because large publish dry-runs can still wait on registry submission behavior.

### 4. Validation & Error Matrix

| Case | Expected behavior |
|------|-------------------|
| `bun run build:npm` | Creates `npm/platforms/<package>/bin/tap` for each supported platform and updates npm package versions |
| `node npm/run.js --version` after build | Uses local fallback binary and prints `tap <version>` |
| Published install on supported platform | npm installs only the compatible optional platform package; `tap` runs through the main wrapper |
| Published install missing platform package | `npm/run.js` exits non-zero and asks user to reinstall `@leolee812/tap` |
| Unsupported OS/CPU | `npm/run.js` exits non-zero with `tap: unsupported platform <platform>-<arch>` |
| Main package dry-run | Tarball is small and contains no platform binaries |
| Platform package dry-run | Tarball contains one `bin/tap` and package metadata only |
| GitHub Actions dry run | Builds packages, verifies wrapper, runs dry-run publish without requiring local npm auth |
| Partial publish rerun | Already published exact package versions are skipped; remaining packages continue |

### 5. Good/Base/Bad Cases

- Good: `npm --cache /tmp/tap-npm-cache pack --dry-run` in `npm/` shows kilobyte-scale main package contents.
- Base: `npm --cache /tmp/tap-npm-cache pack --dry-run` in `npm/platforms/tap-darwin-arm64/` shows exactly `bin/tap` and `package.json`.
- Bad: main package `files` includes `binaries/` or `platforms/`, causing every user to download all platform binaries.
- Bad: root `package.json`, `npm/package.json`, and platform package versions drift.

### 6. Tests Required

Manual checks are required until this repo has a test suite:

```bash
bun run build:npm
node npm/run.js --version
HOME=/tmp/tap-verify-npm node npm/run.js setup --force
npm --cache /tmp/tap-npm-cache pack --dry-run
cd npm/platforms/tap-darwin-arm64 && npm --cache /tmp/tap-npm-cache pack --dry-run
cd ../tap-darwin-x64 && npm --cache /tmp/tap-npm-cache pack --dry-run
cd ../tap-linux-x64 && npm --cache /tmp/tap-npm-cache pack --dry-run
```

Assertion points:

- Main package tarball contains `run.js`, `install.js`, `package.json`, and `skills/` only.
- Main package tarball does not contain `bin/tap`, `binaries/`, or `platforms/`.
- Each platform package tarball contains one compiled `bin/tap`.
- `node npm/run.js setup --force` writes only under the overridden `HOME`.

### 7. Wrong vs Correct

Wrong:

```json
{
  "files": ["run.js", "install.js", "binaries/", "skills/"]
}
```

Correct:

```json
{
  "files": ["run.js", "install.js", "skills/"],
  "optionalDependencies": {
    "@leolee812/tap-darwin-arm64": "0.1.1",
    "@leolee812/tap-darwin-x64": "0.1.1",
    "@leolee812/tap-linux-x64": "0.1.1"
  }
}
```

Wrong:

```js
spawnSync(path.join(__dirname, 'binaries', name), args);
```

Correct:

```js
spawnSync(require.resolve(`${packageName}/bin/tap`), args, {
  env: { ...process.env, TAP_PACKAGE_ROOT: __dirname },
});
```

---

## Naming Conventions

- Files: `kebab-case.js`
- Adapters: `adapters/<site>/<command>.js` — site and command names are lowercase, no hyphens
- Compiled binary: `tap` (no extension)

---

## Examples

- Core module pattern: `src/cdp.js` — one class + two exported functions, no side effects
- Adapter pattern: `adapters/<site>/<command>.js` — single default export with `args`, `output.fields`, optional `columns`, and `pipeline`
