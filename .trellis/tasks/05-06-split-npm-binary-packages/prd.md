# Split npm Binary Packages

## Goal
Reduce the installed/downloaded size of the TAP npm package by moving platform-specific compiled binaries out of the main package and into platform-specific optional dependency packages.

## Requirements
- Keep the main npm package `@leolee812/tap` small.
- Create platform packages for the compiled Bun binaries:
  - `@leolee812/tap-darwin-arm64`
  - `@leolee812/tap-darwin-x64`
  - `@leolee812/tap-linux-x64`
- Use npm `optionalDependencies` so installation downloads only the package compatible with the user's platform.
- Keep `node npm/run.js ...` working in local development after `bun run build:npm`.
- Keep runtime behavior unchanged for users: `tap <args>` still dispatches to the platform binary and sets `TAP_PACKAGE_ROOT`.
- Preserve explicit setup behavior: npm install must not create or modify `~/.tap`.
- Keep version numbers aligned between the root package, main npm package, and platform packages.

## Acceptance Criteria
- [x] `bun run build:npm` creates a small main package without bundled multi-platform binaries.
- [x] `bun run build:npm` creates one package directory per supported platform with exactly one compiled binary.
- [x] `node npm/run.js --version` works locally after build.
- [x] `npm publish --dry-run` from `npm/` shows the main package no longer includes `binaries/`.
- [x] `npm publish --dry-run` from a platform package shows only that platform's binary and package metadata.
- [x] README documentation describes the split-package install model.
- [x] GitHub Actions provides a manual npm publish workflow using `NPM_TOKEN`.
- [x] Publish script dry-run verifies package contents with `npm pack --dry-run` instead of waiting on registry publish behavior.

## Technical Notes
- Main package should keep bundled assistant skill assets because `tap skill install ...` uses `TAP_PACKAGE_ROOT`.
- Platform packages should be marked with `os` and `cpu` constraints.
- Main package `run.js` should resolve the platform package first, with a local development fallback to `npm/platforms/<package>/bin/tap`.
