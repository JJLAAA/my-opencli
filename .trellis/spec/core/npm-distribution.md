# Npm Distribution

> Contracts for split npm packages, wrapper runtime, and publish flow.

---

## Scope / Trigger

Use this contract when changing npm package layout, platform binary build outputs, publish scripts, the npm wrapper runtime, application logic, or bundled resources shipped through the npm package.

This is an infra/cross-layer contract because these files must agree:

- `scripts/build-npm.js`
- `scripts/publish-npm.js`
- `.github/workflows/publish-npm.yml`
- `package-lock.json`
- `npm/package.json`
- `npm/run.js`
- `npm/install.js`
- generated `npm/platforms/<package>/package.json`

---

## Signatures

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

---

## Contracts

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
- Root `package-lock.json` must stay aligned with root `package.json` for package name, version, and `bin` metadata.
- Any change to application logic or bundled resources must include a version bump before publishing so users can receive the update through npm.
- Use a small semver iteration for routine code logic and bundled resource changes; patch versions are the default for backward-compatible fixes or additions.
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

---

## Validation & Error Matrix

| Case | Expected behavior |
|------|-------------------|
| `bun run build:npm` | Creates `npm/platforms/<package>/bin/tap` for each supported platform and updates npm package versions |
| `node npm/run.js --version` after build | Uses local fallback binary and prints `tap <version>` |
| Version bump | `package.json`, `package-lock.json`, `npm/package.json`, and generated platform package metadata all use the same version |
| Code logic or bundled resource change | Release commit includes a small version bump so GitHub Actions publishes a new npm version instead of skipping the existing one |
| Published install on supported platform | npm installs only the compatible optional platform package; `tap` runs through the main wrapper |
| Published install missing platform package | `npm/run.js` exits non-zero and asks user to reinstall `@leolee812/tap` |
| Unsupported OS/CPU | `npm/run.js` exits non-zero with `tap: unsupported platform <platform>-<arch>` |
| Main package dry-run | Tarball is small and contains no platform binaries |
| Platform package dry-run | Tarball contains one `bin/tap` and package metadata only |
| GitHub Actions dry run | Builds packages, verifies wrapper, runs dry-run publish without requiring local npm auth |
| Partial publish rerun | Already published exact package versions are skipped; remaining packages continue |

---

## Good/Base/Bad Cases

- Good: `npm --cache /tmp/tap-npm-cache pack --dry-run` in `npm/` shows kilobyte-scale main package contents.
- Base: `npm --cache /tmp/tap-npm-cache pack --dry-run` in `npm/platforms/tap-darwin-arm64/` shows exactly `bin/tap` and `package.json`.
- Good: a CLI logic change or bundled skill/resource update is paired with a patch version bump before running the publish workflow.
- Bad: main package `files` includes `binaries/` or `platforms/`, causing every user to download all platform binaries.
- Bad: root `package.json`, `npm/package.json`, and platform package versions drift.
- Bad: code logic or bundled resources changed but root `package.json` kept the already-published version, causing the publish workflow to skip the update.

---

## Tests Required

Manual checks are required until this repo has a test suite:

```bash
bun run build:npm
node npm/run.js --version
HOME=/tmp/tap-verify-npm node npm/run.js setup --force
npm --cache /tmp/tap-npm-cache pack --dry-run
cd npm/platforms/tap-darwin-arm64 && npm --cache /tmp/tap-npm-cache pack --dry-run
cd ../tap-darwin-x64 && npm --cache /tmp/tap-npm-cache pack --dry-run
cd ../tap-linux-x64 && npm --cache /tmp/tap-npm-cache pack --dry-run
rg "<old-version>|<old-package-name>|<old-bin-name>" package.json package-lock.json npm/package.json npm/platforms
```

Assertion points:

- `package-lock.json` root package name, version, and `bin` metadata match `package.json`.
- Main package tarball contains `run.js`, `install.js`, `package.json`, and `skills/` only.
- Main package tarball does not contain `bin/tap`, `binaries/`, or `platforms/`.
- Each platform package tarball contains one compiled `bin/tap`.
- `node npm/run.js setup --force` writes only under the overridden `HOME`.

---

## Wrong vs Correct

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
