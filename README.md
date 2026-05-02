# TAP

A lightweight CLI tool for executing declarative data pipelines that fetch and transform data from web sources.

> TAP is a lightweight version of [opencli](https://github.com/jackwener/opencli). The core difference is intentional browser isolation: TAP treats Chrome as a dedicated agent runtime instead of controlling the user's everyday browser through a daemon and extension.

---

*[中文文档](README.zh.md)*

```
tap <site> <command> [--key value]
```

## Core Value

TAP's value is turning data and operations that already exist in business systems, but are not suitable for agents to consume directly, into stable, verifiable, and structured CLI capabilities.

The goal is to let agents work with real business context for querying, diagnosis, summarization, troubleshooting, and decision support without forcing them to understand complex UIs or write one-off scrapers.

## How It Works

TAP separates **what to fetch** from **how to fetch it**:

- **Adapters** (`~/.tap/adapters/<site>/<command>.js`) declare the pipeline — a sequence of steps describing where to get data and how to shape it.
- **Core engine** executes those steps, handles browser sessions, and formats output.

### Execution Flow

```
CLI Args
  └─ Load Adapter from ~/.tap/adapters/<site>/<command>.js
       └─ executePipeline(steps, args, cdpSession?)
            └─ printOutput(data, format, { adapter, site, command, args })
```

The pipeline runs steps sequentially. Each step receives the output of the previous step as `data` and produces a new `data` for the next. Steps can also save results with `as` and read them later with `from`, which keeps multi-request adapters readable without hiding orchestration inside one large script.

---

## TAP vs OpenCLI

OpenCLI optimizes for low-friction reuse of the user's existing Chrome session. It uses a local daemon plus a Browser Bridge extension to control the already-running browser, so browser-backed commands can reuse the cookies and tabs from the user's daily Chrome profile.

TAP deliberately uses a different model: Chrome is an **agent operating platform**. Browser-backed adapters connect to a Chrome instance that the user explicitly starts with remote debugging, usually with a dedicated profile such as `~/.chrome-automation-profile`. You log into target sites inside that profile once, then TAP reuses that agent profile for future runs.

This keeps human browsing and agent automation separate:

- Agent mistakes are contained to the automation profile, not the user's daily browser.
- Cookies, localStorage, extensions, and tabs are reproducible and easier to debug.
- No browser extension or daemon is required.
- The trade-off is an explicit first-time initialization step: start the agent Chrome and log in there.

---

## Installation

**Prerequisites:** [Bun](https://bun.sh) runtime.

```bash
git clone <repo>
cd tap
bun install
bun run build        # produces ./tap binary
```

Move the binary somewhere on your `$PATH`:

```bash
mv tap /usr/local/bin/tap
```

Initialize user-owned TAP files explicitly:

```bash
tap setup
```

`tap setup` creates `~/.tap/`, writes a default `~/.tap/config.json`, and installs bundled adapters into `~/.tap/adapters/` when bundled adapters exist. Existing adapter files are kept unless you pass `--force`.

---

## Usage

```bash
# List available sites and commands
tap help

# Initialize or refresh local TAP files
tap setup
tap setup --force

# Diagnose local setup
tap doctor

# Manage agent Chrome
tap browser start
tap browser status
tap browser stop

# List commands for a site after installing an adapter
tap help example

# Show command options
tap help example list
# or:
tap example list --help

# Run a command
tap example list
tap example list --limit 10
```

### Output Format

| Flag | Description |
|------|-------------|
| _(default)_ / `--format json` | JSON envelope with `meta`, `schema`, and `items` for agent-friendly parsing |

JSON is the only supported command output format. `--format json` is accepted for explicitness, but it is optional for all commands.

### Exit Codes

| Code | Name | Meaning | Agent Response |
|------|------|---------|----------------|
| 0 | success | Command completed | Parse stdout |
| 1 | general_error | Unexpected failure | Inspect error; usually stop |
| 2 | usage_error | Bad invocation, unknown option, missing required arg, unsupported format | Fix command |
| 3 | config_error | Missing or invalid TAP setup | Run `tap setup` |
| 4 | browser_error | Chrome/CDP unavailable | Run `tap browser status` / `tap browser start` |
| 5 | upstream_error | Network or remote API failure | Retry if `retryable: true` |
| 6 | adapter_contract_error | Adapter schema invalid | Fix adapter |

### Structured Errors

CLI failures produce a JSON error on stderr:

```json
{
  "error": {
    "code": "missing_required_arg",
    "message": "Missing required argument: --subreddit",
    "suggestion": "Run: tap reddit hot --help",
    "retryable": false,
    "details": {}
  }
}
```

### JSON Management Commands

```bash
# Diagnostics
tap doctor
# → { "ok": true, "checks": [...], "suggestions": [] }

# Browser lifecycle
tap browser status
# → { "ok": true, "endpoint": "...", "browser": "Chrome/..." }

tap browser start
# → { "alreadyRunning": false, "endpoint": "...", "chrome": "...", "profile": "..." }

tap browser stop
# → { "stopped": true, "endpoint": "..." }

# Setup
tap setup
# → { "directories": [...], "config": { "path": "...", "written": true }, ... }
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TAP_CDP_ENDPOINT` | `http://127.0.0.1:9222` | Chrome DevTools Protocol endpoint for browser-based adapters |
| `TAP_ADAPTERS_DIR` | _(none)_ | Additional directory to search for adapters (takes priority over user and built-in adapters) |
| `TAP_CHROME_PATH` | _(auto-detected)_ | Chrome executable path used by `tap browser start` |

### Adapter Search Order

When `TAP_ADAPTERS_DIR` is set:

1. `$TAP_ADAPTERS_DIR/<site>/<command>.js`
2. `~/.tap/adapters/<site>/<command>.js`
3. `<repo>/adapters/<site>/<command>.js` (built-ins)

Without `TAP_ADAPTERS_DIR`:

1. `~/.tap/adapters/<site>/<command>.js`
2. `<repo>/adapters/<site>/<command>.js` (built-ins)

The first match wins.

---

## Adapter Reference

### File Structure

```js
// ~/.tap/adapters/<site>/<command>.js
export default {
  description: 'Short description shown in help.',
  args: [
    { name: 'limit', default: 20, description: 'Max items to return.' },
    { name: 'keyword', required: true, description: 'Search term.' },
  ],
  output: {
    type: 'list',
    itemName: 'item',
    fields: {
      rank: {
        type: 'integer',
        description: 'One-based rank in the returned result set.',
      },
      title: {
        type: 'string',
        description: 'Item title.',
      },
    },
  },
  pipeline: [ /* steps */ ],
};
```

| Field | Required | Description |
|-------|----------|-------------|
| `description` | No | Shown in `tap help <site> <command>` |
| `args` | No | CLI params with defaults and descriptions |
| `output.fields` | Yes for JSON output | Machine-readable field contract used to build the JSON schema |
| `pipeline` | Yes | Ordered array of steps |

### JSON Output Contract

Data commands print a JSON envelope:

```json
{
  "meta": {
    "site": "example",
    "command": "list",
    "resultType": "list",
    "generatedAt": "2026-05-01T12:00:00.000Z",
    "args": { "limit": 5 }
  },
  "schema": {
    "type": "array",
    "itemName": "item",
    "items": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "description": "Item title."
        }
      }
    }
  },
  "items": [
    { "title": "Example" }
  ]
}
```

The runtime does not infer field meaning from row keys. JSON output requires explicit `output.fields`, and `items` only includes fields declared there. Extra fields produced by the pipeline are dropped from JSON output.

### Pipeline Steps

Each step is an object with a single key naming the operation.

#### Step Reference

| Step | Params | Updates `data` | Browser | Notes |
|------|--------|----------------|---------|-------|
| `fetch` | string URL or `{ url, as? }` | Parsed JSON response | No | Host-side HTTP GET. `as` saves the response in `state`. |
| `browserFetch` | `{ url, as?, method?, headers?, body?, credentials? }` | Parsed JSON response | Yes | Runs page-context `fetch()`. `credentials` defaults to `include`. |
| `navigate` | URL string | No | Yes | Opens a page and waits for load + SPA settle delay. |
| `evaluate` | JS expression string or `{ code, as? }` | Return value | Yes | Runs in page context. Object form can save the return value with `as`. |
| `intercept` | `{ capture, trigger?, timeout?, select?, as? }` | Captured JSON response(s) | Yes | Captures matching XHR/fetch responses after a trigger. |
| `select` | path string or `{ from?, path?, as? }` | Selected value | No | `from` reads current `data` by default, or a named state/path. |
| `map` | `{ select?, ...fields }` | Array of mapped objects | No | Maps each array item. `select` is an inline source path from current `data`. |
| `mapOne` | `{ ...fields }` | One mapped object | No | Maps the current value; mainly used inside `foreach`. |
| `foreach` | `{ from?, as?, concurrency?, steps }` | Array of nested results | Depends on nested steps | Iterates an array and collects each nested pipeline result. |
| `filter` | JS expression string | Filtered array | No | Expression gets `item`, `index`, `args`, `data`, and `state`. |
| `sort` | field string or `{ by, order? }` | Sorted array | No | `order: 'desc'` reverses the sort. |
| `limit` | number or template string | Sliced array | No | Usually last. |

#### `fetch` — HTTP GET

```js
{ fetch: 'https://api.example.com/data' }
// or with template:
{ fetch: { url: 'https://api.example.com/search?q=${{ args.keyword }}' } }
// save the result for later steps:
{ fetch: { url: 'https://api.example.com/projects', as: 'projects' } }
```

Returns parsed JSON. No browser required.

#### `browserFetch` — HTTP GET in browser context

```js
{ browserFetch: { url: '/api/feed', as: 'feed' } }
```

Runs `fetch()` inside the current browser page, using `credentials: 'include'` by default. Use after `navigate` when an API needs the agent Chrome login state.

#### `navigate` — Open URL in browser

```js
{ navigate: 'https://example.com' }
```

Waits for `Page.loadEventFired` + 800ms for SPA initialization. Requires Chrome with remote debugging.

#### `evaluate` — Run JS in browser context

```js
{ evaluate: `document.title` }
{ evaluate: { code: `location.href`, as: 'currentUrl' } }
// or async:
{ evaluate: `(async () => {
  const res = await fetch('/api/data');
  return res.json();
})()` }
```

Replaces `data` with the return value. Runs with full page context (cookies, session). Use object form when you need to save the result with `as`.

#### `intercept` — Capture XHR/fetch requests

```js
{ intercept: {
  capture: 'api/timeline',       // URL substring to match
  trigger: 'navigate:https://example.com/feed',  // what action causes the request
  timeout: 8,                    // seconds to wait (default: 8)
  select: 'data.items',         // selector path to sub-select from captured response
}}
```

Patches `window.fetch` and `XMLHttpRequest` in the page to intercept matching requests.

**Trigger prefixes:**

| Prefix | Example |
|--------|---------|
| `navigate:` | `navigate:https://example.com` |
| `evaluate:` | `evaluate:document.querySelector('.load-more').click()` |
| `click:` | `click:.load-more-btn` |
| `scroll` | `scroll` or `scroll:down` / `scroll:up` |

#### `select` — Extract nested values

```js
{ select: 'data.list' }
{ select: 'result.0.items' }
{ select: 'data.items[0].title' }
{ select: 'data["hot-list"][*].title' }
{ select: 'groups[*].items[*]' }
{ select: { from: 'projects', path: 'items', as: 'items' } }
```

Supported selector syntax:

| Syntax | Description |
|--------|-------------|
| `data.items.0.title` | Legacy dot path with numeric array segments |
| `data.items[0].title` | Bracket array index |
| `data["hot-list"]` | Quoted key for names with punctuation or dots |
| `data.items[*].title` | Project one field from every array item |
| `groups[*].items[*]` | Flatten nested arrays by one level per wildcard |

Missing paths return `null`.

Use `{ from, path, as }` to read from a named state value and save the selected result under another name. `from` can be a state name or path such as `projects.items`.

#### `map` — Transform array items

```js
{ map: {
  rank:   '${{ index + 1 }}',
  title:  '${{ item.title }}',
  author: '${{ item.owner.name }}',
  play:   '${{ item.stat.view }}',
}}
```

Supports inline `select` to sub-select before mapping:

```js
{ map: {
  select: 'data.list',          // sub-select first
  title: '${{ item.title }}',
}}
```

#### `mapOne` — Transform one value

```js
{ mapOne: {
  id: '${{ item.id }}',
  status: '${{ data.status }}',
}}
```

Transforms the current value into one object. This is mainly useful inside `foreach`, where `item` is the original iterated item and `data` is the current nested-step result.

#### `foreach` — Run steps for each item

```js
{
  foreach: {
    from: 'items',
    as: 'details',
    concurrency: 5,
    steps: [
      { fetch: { url: 'https://api.example.com/items/${{ item.id }}' } },
      { mapOne: {
        id: '${{ item.id }}',
        title: '${{ item.title }}',
        status: '${{ data.status }}',
      }},
    ],
  },
}
```

Reads an array from current `data` or a named state path, runs nested steps for each item, and collects the final nested result into an array. Nested steps can read `state`, but their local `as` values do not mutate shared state; use `foreach.as` to save the collected result.

#### `filter` — Retain items by expression

```js
{ filter: 'item.play > 10000' }
{ filter: 'index < 5' }
```

#### `sort` — Sort array

```js
{ sort: { by: 'play', order: 'desc' } }
{ sort: 'title' }
```

#### `limit` — Slice to N items

```js
{ limit: 20 }
{ limit: '${{ args.limit }}' }
```

### Template Expressions

Templates use `${{ expression }}` syntax. Available context variables:

| Variable | Availability | Description |
|----------|-------------|-------------|
| `item` | `map`, `filter` | Current array element |
| `index` | `map`, `filter` | Zero-based position |
| `args` | All | Parsed CLI args (after applying defaults) |
| `data` | All | Current pipeline data |
| `state` | All templates | Named values saved by `as` |
| `root` | `map` | Original data before inline select |

---

## Adapter Patterns

### Pattern A — Public JSON API

No browser needed. Direct HTTP fetch.

```js
export default {
  args: [{ name: 'limit', default: 20 }],
  output: {
    type: 'list',
    itemName: 'entry',
    fields: {
      title: {
        type: 'string',
        description: 'Entry title.',
      },
      score: {
        type: 'number',
        description: 'Entry score from the source API.',
      },
    },
  },
  pipeline: [
    { fetch: 'https://api.example.com/top' },
    { select: 'data.list' },
    { map: { title: '${{ item.title }}', score: '${{ item.score }}' } },
    { limit: '${{ args.limit }}' },
  ],
};
```

### Pattern B — Login-gated API (browser cookies)

Navigate first to establish session, then fetch inside browser context.

```js
pipeline: [
  { navigate: 'https://example.com' },
  { evaluate: `(async () => {
    const res = await fetch('/api/feed', { credentials: 'include' });
    return res.json();
  })()` },
  { select: 'data.items' },
  { map: { title: '${{ item.title }}' } },
  { limit: '${{ args.limit }}' },
],
```

### Pattern C — Multi-request list-detail

Fetch a list, fetch each item's detail with bounded concurrency, then return the collected detail rows.

```js
pipeline: [
  { fetch: { url: 'https://api.example.com/items', as: 'list' } },
  { select: { from: 'list', path: 'items', as: 'items' } },
  {
    foreach: {
      from: 'items',
      as: 'details',
      concurrency: 5,
      steps: [
        { fetch: { url: 'https://api.example.com/items/${{ item.id }}' } },
        { mapOne: {
          title: '${{ item.title }}',
          status: '${{ data.status }}',
        }},
      ],
    },
  },
  { select: { from: 'details' } },
  { limit: '${{ args.limit }}' },
],
```

Use the same pattern with `browserFetch` after `navigate` when detail APIs need browser cookies.

### Pattern D — Intercepted XHR/fetch

Capture API calls triggered by page interaction.

```js
pipeline: [
  { intercept: {
    capture: '/api/timeline',
    trigger: 'navigate:https://example.com/home',
    timeout: 10,
    select: 'data',
  }},
  { map: { title: '${{ item.title }}' } },
  { limit: '${{ args.limit }}' },
],
```

### Pattern E — DOM extraction

Scrape data directly from rendered HTML.

```js
pipeline: [
  { navigate: 'https://example.com/ranking' },
  { evaluate: `
    [...document.querySelectorAll('.item')].map(el => ({
      title: el.querySelector('.title')?.textContent?.trim(),
      link:  el.querySelector('a')?.href,
    }))
  ` },
  { map: { rank: '${{ index + 1 }}', title: '${{ item.title }}' } },
  { limit: '${{ args.limit }}' },
],
```

---

## Browser-Based Adapters

Adapters using `navigate`, `evaluate`, `browserFetch`, or `intercept` require a running agent Chrome instance with remote debugging enabled. The recommended path is:

```bash
tap setup
tap browser start
tap doctor
```

`tap browser start` uses a dedicated automation profile (`~/.chrome-automation-profile` by default) so agent browsing is separate from your daily Chrome profile. Headed Chrome starts minimized by default; use `tap browser start --foreground` if you want the window opened normally, or `tap browser start --headless` for a fully hidden browser. Log into target sites inside this agent Chrome profile only when an adapter needs login state. TAP auto-detects whether an adapter needs the browser by scanning its pipeline steps. A background tab is opened per run where Chrome supports it and closed when done.

---

## Building Adapters with AI

TAP ships with an AI assistant skill (`tap-adapter-author`) that guides you through the full adapter authoring loop — from site reconnaissance to a working `tap <site> <command>` output.

### Setup

Install the skill explicitly for the assistant you use:

```bash
tap skill install claude-code
tap skill install codex
```

Use `--target <dir>` for a custom skills directory, or `--force` to overwrite files in an existing `tap-adapter-author` skill directory:

```bash
tap skill install codex --target ~/.codex/skills
tap skill install claude-code --force
```

The skill depends on the **chrome-devtools MCP** for automated reconnaissance (network monitoring and DOM inspection). Two manual steps are required before using it:

1. **Configure chrome-devtools MCP** in your Claude Code settings.

2. **Launch Chrome with remote debugging and log in** to any sites you plan to scrape:

   ```bash
   # macOS
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
     --remote-debugging-port=9222 \
     --user-data-dir=~/.chrome-automation-profile \
     --no-first-run \
     --no-default-browser-check
   ```

   The skill reuses the logged-in agent Chrome profile — it does not handle authentication itself. This is intentionally separate from your daily Chrome profile.

> **Planned**: automate both steps so no manual setup is needed.

### Workflow

Invoke the skill and describe what you want:

```
/tap-adapter-author

I want to fetch the top posts from Hacker News.
```

The skill will:

1. **Identify the fetch pattern** — public API, login-gated, multi-request list-detail, intercepted XHR, or DOM scraping
2. **Validate the endpoint** — confirm the API returns the expected data
3. **Decode the field structure** — map response fields to schema-confirmed output fields
4. **Confirm the schema** — review field names, raw paths, types, descriptions, units, formats, and examples
5. **Assemble the pipeline** — produce a complete adapter file with `output.fields`
6. **Install it** — write to `~/.tap/adapters/<site>/<command>.js`
7. **Verify** — run `tap <site> <command>` and confirm the envelope schema and items

### Decision Tree

```
What data do you want?
  │
  ├─ Public JSON API (curl works)          → Pattern A: direct fetch
  ├─ Needs browser login/session           → Pattern B: navigate + browserFetch
  ├─ List-detail or enrichment requests    → Pattern C: as + from + foreach
  ├─ XHR hidden behind page interaction    → Pattern D: intercept
  └─ Data only in DOM                      → Pattern E: navigate + evaluate(DOM)
```

If stuck, the skill has a fallback path for each failure mode (403, empty array, missing fields, etc).

---

## Examples

TAP no longer ships site-specific example adapters by default. Use `tap-adapter-author` to create a schema-confirmed adapter under `~/.tap/adapters/<site>/<command>.js`, then run it:

```bash
tap example list --limit 5
```

---

## Project Structure

```
tap/
├── bin/cli.js              # Entry point — delegates to src/cli.js
├── src/
│   ├── cli.js              # Arg parsing, help routing, pipeline orchestration
│   ├── executor.js         # Pipeline execution engine
│   ├── cdp.js              # Chrome DevTools Protocol session
│   ├── adapters.js         # Adapter discovery and loading
│   ├── help.js             # Help text generation
│   └── output.js           # JSON formatter
├── adapters/               # Optional built-in adapters
└── skills/                 # Bundled assistant skills
    └── tap-adapter-author/
```

User adapters live in `~/.tap/adapters/` and take precedence over built-ins.

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `ws` ^8.0.0 | WebSocket client for CDP communication |

Runtime: [Bun](https://bun.sh) (build + execution). The compiled binary is self-contained and does not require Bun at runtime.
