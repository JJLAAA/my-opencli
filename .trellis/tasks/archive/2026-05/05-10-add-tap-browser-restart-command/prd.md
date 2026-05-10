# Add tap browser restart command

## Goal

Add `tap browser restart` so users can close and relaunch the dedicated Agent Chrome instance when it starts interfering with daily Chrome link handling after Chrome updates or restarts.

## What I already know

* The user wants to implement option 1 first: a `restart` management command.
* Existing browser lifecycle commands are `tap browser start`, `tap browser status`, and `tap browser stop`.
* Browser lifecycle logic lives in `src/browser.js`; side-command dispatch lives in `src/cli.js`; management command schema lives in `src/schema.js`.
* README and README.zh.md must stay aligned for user-facing CLI capability changes.

## Assumptions

* `restart` should preserve the existing `start` options: `--headless` and `--foreground`.
* `restart` should be idempotent when the Agent Chrome CDP endpoint is not reachable: report that no stop was needed, then start a fresh Agent Chrome.
* It is acceptable to request stop via CDP and then wait briefly for the endpoint to become unreachable before starting again.

## Requirements

* Add `tap browser restart [--headless] [--foreground]`.
* Reuse existing stop/start behavior and output JSON.
* Include the command in help text and machine-readable schema.
* Update English and Chinese README references together.

## Acceptance Criteria

* [x] `bun run bin/cli.js browser restart --help` shows restart usage.
* [x] `bun run bin/cli.js schema browser restart` returns a management schema with `headless` and `foreground` boolean args.
* [x] `bun run bin/cli.js browser restart --bad` returns a structured usage error.
* [x] `bun run bin/cli.js browser restart` actually stops and starts the Agent Chrome instance.
* [x] `bun run build` succeeds.
* [x] `bun run build:npm` succeeds.
* [x] `trellis-check` review passes with no findings.

## Out of Scope

* Switching TAP to Chrome for Testing or Chromium by default.
* Adding a broader browser setup/config command.
* Changing default Chrome profile or CDP endpoint behavior.

## Technical Notes

* Relevant specs read: core directory structure, local runtime, error handling, logging guidelines, shared thinking guides.
* Existing `stopBrowser()` returns success when CDP is unreachable, which fits restart idempotency.
