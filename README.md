# TAP

A lightweight CLI tool for executing declarative data pipelines that fetch and transform data from web sources.

> TAP is a lightweight version of [opencli](https://github.com/jackwener/opencli). The core difference is intentional browser isolation: TAP treats Chrome as a dedicated agent runtime instead of controlling the user's everyday browser through a daemon and extension.

---

*[Chinese documentation](README.zh.md)*

```
tap <site> <command> [--key value]
```

## Core Value

TAP's value is turning data and operations that already exist in business systems, but are not suitable for agents to consume directly, into stable, verifiable, and structured CLI capabilities.

The goal is to let agents work with real business context for querying, diagnosis, summarization, troubleshooting, and decision support without forcing them to understand complex UIs or write one-off scrapers.

## Design Decision: Data Access Layer, Not a Trigger Skill

TAP is intended to be embedded into other agent workflows as a structured data access layer. It does not include a heuristic "use TAP" skill that tries to infer every possible data-fetching intent, because TAP is never meant to be spontaneously discovered by an agent.

The intended flow is two-phase and human-initiated:

1. **A human expresses intent using `tap-adapter-author`** — describing what data source to access. The skill guides the full loop: site reconnaissance, endpoint validation, schema confirmation, pipeline assembly, and installation of the adapter under `~/.tap/adapters/<site>/<command>.js`.
2. **The adapter is then declared into a specific workflow** — from that point on, an agent operates within that workflow and calls `tap` as a structured data source. The agent uses `tap schema` to discover the contract and calls the command; it does not need to reason about whether TAP is the right tool.

This means TAP's agent-friendly design (schema introspection, structured errors, exit codes, JSON output) serves agents that already know they are inside a TAP-enabled workflow — not agents discovering TAP autonomously. The `tap-adapter-author` skill is the human-side entry point; TAP itself is the agent-side execution interface. The two have separate roles and do not overlap.

## When Not to Use TAP

TAP is not a general-purpose web scraper or research tool. The right question to ask is: **is this a known data source you will access repeatedly, or a one-off information retrieval task?**

| Scenario | Use TAP? | Better alternative |
|----------|----------|--------------------|
| Pull structured data from an internal dashboard every day | Yes | — |
| Query a business system that has no API | Yes | — |
| Deep research across arbitrary web sources | No | LLM native web browse |
| Summarize or analyze an article | No | LLM native web browse |
| One-off data lookup with no fixed schema | No | LLM native web browse |

The cost of TAP is upfront: a human authors an adapter, encodes the data contract, and installs it. That investment only pays off when the same access pattern repeats. If the data source is dynamic, the schema is unknown, or you only need to fetch something once, use your agent's native web capabilities instead.

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

### npm (recommended)

```bash
npm install -g @leolee812/tap
```

This installs a small wrapper package that automatically pulls in the prebuilt binary for your OS and CPU. No Bun or build step required.

Then initialize user-owned TAP files:

```bash
tap setup
```

### From source (for contributors)

**Prerequisites:** [Bun](https://bun.sh) runtime.

```bash
git clone <repo>
cd tap
bun install
bun run build        # produces ./tap binary
mv tap /usr/local/bin/tap
tap setup
```

---

**Installation scope:** installing the TAP binary installs only the CLI runtime: command parsing, pipeline execution, schema output, browser control, and local config. TAP does not bundle site-specific adapters or install assistant instructions automatically.

Install an adapter pack only when you want ready-made commands for a specific data source. Adapter packs add files under `~/.tap/adapters/`, which is what turns a generic command like `tap <site> <command>` into a concrete data pipeline.

Install the assistant skill only when you want your AI coding assistant to help author new adapters. The skill is not needed to run existing adapters; it teaches the assistant the TAP adapter workflow and writes the resulting adapter into your local adapter directory.

```bash
tap adapter install github:<owner>/<repo>
tap skill install codex
```

Use `tap skill install claude-code` instead if you use Claude Code.

`tap setup` creates `~/.tap/`, `~/.tap/adapters/`, `~/.tap/logs/`, and a default `~/.tap/config.json`. Existing config is kept unless you pass `--force`.

---

## Usage

```bash
# List available sites and commands
tap help

# Print the installed version
tap version
tap --version
tap -v

# Initialize or refresh local TAP files
tap setup
tap setup --force

# Diagnose local setup
tap doctor

# Discover machine-readable command contracts
tap schema
tap schema <site>
tap schema <site> <command>
tap schema browser start
tap schema browser restart

# Manage agent Chrome
tap browser start
tap browser status
tap browser stop
tap browser restart

# Install, list, or remove adapter packs
tap adapter install github:<owner>/<repo>
tap adapter install url:<https-url-to-zip-or-tarball>
tap adapter install git:<git-url>
tap adapter install git:<git-url> --force
tap adapter list
tap adapter remove <pack-name>

# List commands for a site after installing an adapter
tap help <site>

# Show command options
tap help <site> <command>
# or:
tap <site> <command> --help

# Run an adapter command
tap <site> <command>
tap <site> <command> --limit 10
```

### Output Format

| Flag | Description |
|------|-------------|
| _(default)_ / `--format json` | JSON envelope with `meta`, `schema`, and `items` for data commands |
| `--fields <f1,f2,...>` | Return only the named fields from the adapter's declared schema |

JSON is the only supported output format for data commands, and management commands also print JSON. `--format json` is accepted for explicitness, but it is optional for those commands. Help commands intentionally print human-readable text.

`--fields` accepts a comma-separated list of field names declared in the adapter's `output.fields`. Unknown field names produce a warning in `meta.warnings` but do not fail. The `schema.items.properties` in the response reflects the effective set of returned fields. Adapter contract diagnostics (missing/dropped field warnings) are always evaluated against the full declared schema, regardless of `--fields`.

### Agent Contract Discovery

Agents should discover commands and arguments from `tap schema` instead of scraping help text.

```bash
# List adapter and management commands
tap schema

# List commands for a site
tap schema <site>

# Inspect one adapter command
tap schema <site> <command>

# Inspect one management command
tap schema browser start
tap schema browser restart
tap schema doctor
```

`tap schema` returns JSON with `meta.schemaVersion` and a `commands` array. Each command includes a `schemaCommand` field that points to the command-specific schema. Command schemas include argument flags, types, defaults, required markers, enum/range constraints, and output schema when applicable.

`tap schema <site>` returns a site-level schema with `meta.kind: "site"`, listing all commands for that site. Each command entry includes `kind`, `site`, `command`, `name`, `description`, and `schemaCommand`. If an adapter cannot be loaded, its entry includes a `loadError` object instead of a description. Unknown sites produce a structured usage error with `code: "unknown_site"`.

For management command schemas, pass only the command words shown by `tap schema` (for example `tap schema browser start`); adapter flags are not part of schema lookup.

### Exit Codes

| Code | Name | Meaning | Agent Response |
|------|------|---------|----------------|
| 0 | success | Command completed | Parse stdout |
| 1 | general_error | Unexpected failure | Inspect error; usually stop |
| 2 | usage_error | Bad invocation, unknown option, missing required arg, unsupported format | Fix command |
| 3 | config_error | Missing or invalid TAP setup | Run `tap setup` |
| 4 | browser_error | Chrome/CDP unavailable | Run `tap browser status` / `tap browser start` |
| 5 | upstream_error | Network or remote API failure | Retry if `retryable: true` |
| 6 | adapter_contract_error / adapter_load_error | Adapter output schema invalid, or adapter file cannot be loaded | Fix adapter `output.fields`, JavaScript syntax, or module export |

Adapter management commands use exit code `2` for usage errors (unknown source format, missing arguments) and exit code `5` for download/clone failures (retryable) and exit code `6` for pack contract errors (invalid `tap-adapter.json`, missing `adapters/` directory) and file conflicts.

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

Adapter load failures include the adapter path and, when TAP can detect the issue, line-level diagnostics in `error.details.diagnostics`.

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

tap browser restart
# → { "stopped": {...}, "started": {...} }

# Setup
tap setup
# → { "directories": [...], "config": { "path": "...", "written": true }, ... }

# Adapter management
tap adapter install github:example/tap-adapters
# → { "ok": true, "action": "install", "pack": {...}, "installed": [...], "overwritten": [], "target": "..." }

tap adapter list
# → { "packs": [...] }

tap adapter remove <pack-name>
# → { "ok": true, "action": "remove", "pack": "...", "removed": [...] }
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TAP_CDP_ENDPOINT` | `http://127.0.0.1:9222` | Chrome DevTools Protocol endpoint for browser-based adapters |
| `TAP_ADAPTERS_DIR` | _(none)_ | Additional directory to search for adapters (takes priority over user adapters) |
| `TAP_CHROME_PATH` | _(auto-detected)_ | Chrome executable path used by `tap browser start` and `tap browser restart` |

### Adapter Search Order

When `TAP_ADAPTERS_DIR` is set:

1. `$TAP_ADAPTERS_DIR/<site>/<command>.js`
2. `~/.tap/adapters/<site>/<command>.js`

Without `TAP_ADAPTERS_DIR`:

1. `~/.tap/adapters/<site>/<command>.js`

The first match wins.

---

## Adapter Reference

### File Structure

```js
// ~/.tap/adapters/<site>/<command>.js
export default {
  description: 'Short description shown in help.',
  args: [
    {
      name: 'limit',
      type: 'integer',
      default: 20,
      minimum: 1,
      maximum: 100,
      description: 'Max items to return.',
    },
    {
      name: 'sort',
      enum: ['hot', 'new'],
      default: 'hot',
      description: 'Sort order.',
    },
    {
      name: 'keyword',
      required: true,
      description: 'Search term.',
    },
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
| `args` | No | CLI params with defaults, descriptions, and validation metadata |
| `examples` | No | Usage examples shown in `tap help <site> <command>`. Array of `{ description?, args }` objects |
| `output.fields` | Yes for JSON output | Machine-readable field contract used to build the JSON schema |
| `pipeline` | Yes to run a data command | Ordered array of steps executed by the pipeline engine |

### Argument Contract

Adapter args are both documentation and runtime validation. Declare enough metadata for an agent to call the command without guessing.

| Arg field | Description |
|-----------|-------------|
| `name` | Flag name without `--` |
| `description` | Human/agent-facing meaning of the argument |
| `required` | When `true`, missing values fail with exit code 2 |
| `default` | Value applied before pipeline execution |
| `type` | `string`, `boolean`, `integer`, or `number`; inferred from `default` when omitted |
| `enum` | Allowed values; invalid values fail before the adapter runs |
| `minimum` / `maximum` | Numeric bounds for `integer` and `number` args |
| `format` / `examples` | Extra schema hints surfaced by `tap schema` |

For adapter execution, unknown flags, invalid types, enum mismatches, out-of-range numbers, and missing required args produce structured JSON errors on stderr with actionable suggestions.

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

The runtime does not infer field meaning from row keys. JSON output requires explicit `output.fields`, and `items` only includes fields declared there. Extra fields produced by the pipeline are dropped from JSON output. This `output.fields` contract is validated before a data command runs; malformed pipeline definitions fail during execution.

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

`tap browser start` uses a dedicated automation profile (`~/.chrome-automation-profile` by default) so agent browsing is separate from your daily Chrome profile. Headed Chrome starts minimized by default; use `tap browser start --foreground` if you want the window opened normally, or `tap browser start --headless` for a fully hidden browser. If agent Chrome starts receiving normal system links after your daily Chrome restarts, start daily Chrome first and then run `tap browser restart`. Log into target sites inside this agent Chrome profile only when an adapter needs login state. TAP auto-detects whether an adapter needs the browser by scanning its pipeline steps. A background tab is opened per run where Chrome supports it and closed when done.

---

## Building Adapters with AI

TAP ships with an AI assistant skill (`tap-adapter-author`) that guides you through the full adapter authoring loop — from site reconnaissance to a working `tap <site> <command>` output.

### Setup

Install the skill explicitly for the assistant you use. This copies TAP's adapter-authoring instructions into that assistant's skill directory, so the assistant can guide reconnaissance, schema design, implementation, and verification in the same workflow:

```bash
tap skill install claude-code
tap skill install codex
```

Use `--target <dir>` for a custom skills directory, or `--force` to overwrite files in an existing `tap-adapter-author` skill directory:

```bash
tap skill install codex --target ~/.codex/skills
tap skill install claude-code --force
```

For browser-based adapters (patterns that need login state), launch Chrome with remote debugging and log in to any target sites before running the skill:

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=~/.chrome-automation-profile \
  --no-first-run \
  --no-default-browser-check
```

The skill reuses the logged-in agent Chrome profile — it does not handle authentication itself. This is intentionally separate from your daily Chrome profile.

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
tap <site> <command> --limit 5
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
│   ├── adapter-manager.js  # Adapter pack install/list/remove
│   ├── schema.js           # Machine-readable command schema generation
│   ├── output.js           # JSON formatter
│   ├── help.js             # Help text generation
│   ├── browser.js          # Agent Chrome lifecycle management
│   ├── doctor.js           # Local setup diagnostics
│   ├── setup.js            # TAP initialization
│   ├── skills.js           # AI skill installation
│   ├── config.js           # Config file reading
│   └── bundled-skills.js   # Embedded skill assets for compiled binaries
├── skills/                 # Source copy of bundled assistant skills
│   └── tap-adapter-author/
└── npm/
    ├── run.js              # npm bin wrapper; selects the platform package
    ├── install.js          # local development executable-bit helper
    ├── platforms/          # generated optional binary packages
    │   ├── tap-darwin-arm64/
    │   ├── tap-darwin-x64/
    │   └── tap-linux-x64/
    └── skills/             # npm package copy of bundled assistant skills
        └── tap-adapter-author/
```

User adapters live in `~/.tap/adapters/`. Use `TAP_ADAPTERS_DIR` to point TAP at a custom adapter directory during development or from another workflow.

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `ws` ^8.0.0 | WebSocket client for CDP communication |

Runtime: [Bun](https://bun.sh) (build + execution). The compiled binary is self-contained and does not require Bun at runtime.
