# Chrome Quiet Background CDP Sessions

## Goal
Reduce user interruption from TAP browser automation while keeping the default headed Chrome profile model.

## Requirements
- Add a quiet headed browser start mode that starts Agent Chrome minimized by default.
- Keep `--headless` available for fully hidden automation and CI-like usage.
- Create CDP tabs in the background where Chrome supports it, so adapter runs are less likely to steal focus.
- Preserve existing cleanup behavior: each run closes its target tab in `finally`.
- Keep browser/runtime behavior in focused `src/` modules, not in `bin/cli.js`.

## Acceptance Criteria
- [x] `tap browser start --help` documents the quiet/minimized behavior.
- [x] `tap browser start` launches Chrome with minimized startup flags unless `--headless` is used.
- [x] `openSession()` creates an about:blank target with CDP `Target.createTarget` and `background: true`.
- [x] Existing adapter execution still receives `{ session, targetId, base }` and `closeTab(base, targetId)` still works.
- [x] `bun run build` succeeds.
- [x] Manual browser status/start checks are run where feasible.

## Technical Notes
- This does not make login-state workflows headless by default.
- `background: true` is a best-effort CDP hint; some Chrome/platform combinations may still raise a window.
