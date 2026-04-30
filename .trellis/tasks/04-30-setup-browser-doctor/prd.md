# Add Setup, Browser, and Doctor Commands

## Goal

Make TAP easier to initialize and diagnose while keeping user filesystem changes explicit.

## Requirements

- Add `tap setup` to initialize local TAP state explicitly.
- `tap setup` must create `~/.tap/`, `~/.tap/adapters/`, and a default `~/.tap/config.json`.
- `tap setup` must install bundled adapters into `~/.tap/adapters/`.
- `tap setup` must skip existing adapter files by default and overwrite only with `--force`.
- Remove adapter copying from npm `postinstall`; package install must not implicitly modify user TAP directories.
- Add `tap browser start`, `tap browser status`, and `tap browser stop`.
- Browser commands must use a dedicated automation Chrome profile by default.
- Add `tap doctor` to diagnose adapter directory, config, Chrome/CDP availability, and bundled adapter install state.
- Do not open target sites or require users to log in during setup.
- Keep implementation in focused `src/` modules; `src/cli.js` should only route side commands.

## Acceptance Criteria

- [ ] `tap setup` creates local TAP directories and installs bundled adapters.
- [ ] `tap setup` does not overwrite existing adapters unless `--force` is passed.
- [ ] npm `postinstall` only prepares package-owned binaries and does not write to `~/.tap`.
- [ ] `tap browser status` reports whether the configured CDP endpoint is reachable.
- [ ] `tap browser start` starts Chrome with remote debugging when Chrome is found.
- [ ] `tap browser stop` closes the browser via CDP when possible.
- [ ] `tap doctor` prints actionable pass/fail diagnostics and exits non-zero when required checks fail.
- [ ] Existing adapter execution still works.

## Technical Notes

- Default CDP endpoint remains `http://localhost:9222`.
- Default Chrome profile is `~/.chrome-automation-profile`.
- Config should be simple JSON and should not override user values unless setup is forced or the file is missing.
- Browser process management should avoid new dependencies.
- The command should support the npm package layout where bundled adapters live under `npm/adapters`.
