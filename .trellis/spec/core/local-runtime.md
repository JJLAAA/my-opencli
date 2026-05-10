# Local Runtime

> Contracts for local TAP state, setup, browser lifecycle, and diagnostics.

---

## Scope / Trigger

Use this contract when adding or changing local TAP state, browser runtime management, or diagnostics. These commands are user-facing CLI contracts and must stay explicit: package installation must not initialize `~/.tap`.

---

## Signatures

```bash
tap setup [--force]
tap browser start [--headless] [--foreground]
tap browser status
tap browser stop
tap browser restart [--headless] [--foreground]
tap doctor
```

Core modules:

- `src/setup.js`: exports `runSetup(options)`, `formatSetupResult(result)`, `setupHelp()`
- `src/browser.js`: exports `startBrowser(options)`, `browserStatus()`, `stopBrowser()`, `restartBrowser(options)`, formatters, and `browserHelp(command)`
- `src/doctor.js`: exports `runDoctor()`, `formatDoctorResult(result)`, `doctorHelp()`
- `src/config.js`: exports default paths and configuration helpers

---

## Contracts

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
- `tap browser restart` requests shutdown through CDP, waits for the configured endpoint to become unreachable, then starts a new agent Chrome using the same start options.
- Browser-backed adapter runs create an `about:blank` CDP target through the Browser websocket using `Target.createTarget({ url, background: true })` before connecting to that page target. This is a best-effort focus-reduction hint; cleanup still uses `closeTab(base, targetId)`.

Side commands must route in `src/cli.js` before adapter discovery and delegate all behavior to focused `src/` modules.

---

## Validation & Error Matrix

| Case | Expected behavior |
|------|-------------------|
| `tap setup` runs without existing local state | Create TAP directories/config; do not install adapters |
| `tap setup` runs with existing config | Keep config and report `written: false` |
| `tap setup --force` runs with existing config | Overwrite config and report `written: true` |
| `tap browser status` cannot reach CDP | Exit non-zero and print endpoint plus connection error |
| `tap browser start` cannot find Chrome | Exit non-zero and ask user to set `TAP_CHROME_PATH` |
| `tap browser stop` when CDP is unreachable | Exit zero and report that agent Chrome was not running |
| `tap browser restart` when CDP is unreachable | Exit zero if a new agent Chrome starts successfully |
| `tap doctor` has any failed required check | Exit non-zero and print suggested next steps |

---

## Good/Base/Bad Cases

- Good: `HOME=/tmp/tap-verify tap setup` creates only files under that HOME.
- Base: running `tap setup` twice keeps existing config unless `--force` is provided.
- Bad: npm `postinstall` writes to `~/.tap` or assistant-specific directories.

---

## Tests Required

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

---

## Wrong vs Correct

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
