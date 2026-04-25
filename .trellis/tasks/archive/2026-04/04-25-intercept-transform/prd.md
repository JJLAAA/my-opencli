# Introduce `intercept` and `transform` Steps from OpenCLI

## Goal

Port the `intercept` and extended `transform` (select, sort) pipeline steps from OpenCLI into TAP, giving adapters the ability to capture XHR/fetch network responses and perform richer data transformations.

## Background

**Source**: `/Users/leo/Projects/OpenCLI`

OpenCLI has two component families that TAP currently lacks:

### `intercept` step
Monkey-patches `window.fetch` and `XMLHttpRequest` in the browser page to intercept network responses matching a URL pattern. Supports trigger actions (navigate, evaluate, click, scroll) before capturing.

### Extended transform steps
OpenCLI has `select` and `sort` that TAP does not. Also, TAP's existing `map` and `filter` are missing `data` / `root` context variables and `map`'s inline `select` sub-key.

## Requirements

### 1. CDPSession additions (`src/cdp.js`)

New methods on `CDPSession`:
- `installInterceptor(pattern)` — injects fetch/XHR monkey-patch JS into the page
- `waitForCapture(timeout)` — polls until at least one response is captured (event-driven poll, 100ms interval)
- `getInterceptedRequests()` — reads and clears `window.__opencli_intercepted`
- `click(selector)` — `document.querySelector(selector)?.click()`
- `scroll(direction)` — `window.scrollTo(0, document.body.scrollHeight)` for 'down'

The interceptor JS must:
- Patch `window.fetch` and `XMLHttpRequest` 
- Use a patch-guard to avoid double-patching
- Store captures in `window.__opencli_intercepted` (non-enumerable)
- Support updating the pattern without re-patching (separate pattern var)
- Disguise patched functions so `toString()` returns native code signature

### 2. New pipeline steps (`src/executor.js`)

#### `intercept` step
```yaml
- intercept:
    trigger: 'click:#load-more'   # navigate:URL | evaluate:JS | click:SELECTOR | scroll
    capture: '/api/posts'          # URL substring to match
    timeout: 8                     # seconds (default: 8)
    select: 'data.items'           # optional dot-path into captured response
```
- If `capture` is empty, pass data through unchanged
- Returns single object if 1 match, array if >1, original data if 0

#### `select` step
```yaml
- select: 'response.data.list'
```
- Dot-path navigation into current data
- Supports numeric indexes for arrays (e.g. `items.0.name`)

#### `sort` step
```yaml
- sort:
    by: 'title'
    order: 'desc'   # asc (default) | desc
```
- Uses `localeCompare` with `numeric: true` for natural sort
- Non-arrays pass through unchanged

### 3. Improved existing steps (`src/executor.js`)

#### `map` improvements
- Add `data` (source array/object) and `root` (original pre-select data) to template context
- Support inline `select` sub-key: `{ map: { select: 'path', key: '${{ item.x }}' } }`

#### `filter` improvements
- Add `data` to the expression context

### 4. `bin/cli.js` update
- `needsBrowser` detection must also include `intercept` steps

## Acceptance Criteria

- [ ] `intercept` step works end-to-end: installs interceptor, triggers action, captures response
- [ ] `select` step navigates dot-paths including numeric array indexes
- [ ] `sort` step sorts arrays by key asc/desc
- [ ] `map` supports inline `select`, `data`, and `root` context
- [ ] `filter` receives `data` context
- [ ] `needsBrowser` in cli.js includes `intercept`
- [ ] All new steps throw `Unknown pipeline step` for unrecognized ops (existing behavior preserved)

## Technical Notes

- TAP is plain JS (no TypeScript) — port accordingly
- Keep `render()` helper as-is (same `${{ }}` syntax)
- Interceptor JS is embedded as a template literal string function in `cdp.js` (no separate file)
- No retry logic needed (OpenCLI has retries at executor level; TAP doesn't)
- Source reference: `/Users/leo/Projects/OpenCLI/src/interceptor.ts` and `/Users/leo/Projects/OpenCLI/src/pipeline/steps/`
