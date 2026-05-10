# Bump npm version for browser restart release

## Goal

Publish the already-implemented browser restart capability by bumping the npm package version so the GitHub Actions publish workflow will produce a new release instead of skipping the existing version.

## What I already know

- Current root version is `0.1.2`.
- npm publish skips exact package versions that already exist.
- `scripts/build-npm.js` derives npm package and platform package versions from root `package.json`.

## Requirements

- Bump the package version from `0.1.2` to `0.1.3`.
- Keep root, main npm package, and generated platform package versions aligned.
- Do not change publish workflow behavior in this task.

## Acceptance Criteria

- [ ] `package.json` version is `0.1.3`.
- [ ] `npm/package.json` version and optional platform dependency versions are `0.1.3`.
- [ ] Generated platform package versions are `0.1.3`.
- [ ] `bun run build:npm` completes successfully.
- [ ] `node npm/run.js --version` reports `tap 0.1.3`.

## Out of Scope

- Publishing to npm.
- Changing GitHub Actions publish semantics.
- Adding release automation.

## Technical Notes

- Relevant spec: `.trellis/spec/core/npm-distribution.md`.
- Existing publish script intentionally skips already published exact package versions for idempotent reruns.
